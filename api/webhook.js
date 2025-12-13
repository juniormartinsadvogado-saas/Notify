
import * as admin from 'firebase-admin';
import sgMail from '@sendgrid/mail';

// Função auxiliar para inicializar o DB de forma segura
function getFirebaseDB() {
    const firebasePkg = admin.default || admin;
    if (!firebasePkg.apps?.length) {
        try {
            const privateKey = process.env.FIREBASE_PRIVATE_KEY 
                ? process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n')
                : undefined;

            const serviceAccount = {
                projectId: process.env.FIREBASE_PROJECT_ID,
                clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
                privateKey: privateKey,
            };

            if (!serviceAccount.projectId || !serviceAccount.clientEmail || !serviceAccount.privateKey) {
                console.error("[WEBHOOK INIT] Faltam variáveis de ambiente do Firebase.");
                return null;
            }

            firebasePkg.initializeApp({
                credential: firebasePkg.credential.cert(serviceAccount),
                storageBucket: "notify-jma.firebasestorage.app"
            });
        } catch (error) {
            if (error.code !== 'app/duplicate-app') {
                console.error('[WEBHOOK INIT] Erro fatal:', error);
                return null;
            }
        }
    }
    return firebasePkg.firestore();
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,POST');
  res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, asaas-access-token');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
      const asaasToken = req.headers['asaas-access-token'];
      if (process.env.ASAAS_WEBHOOK_TOKEN && asaasToken !== process.env.ASAAS_WEBHOOK_TOKEN) {
          console.warn(`[WEBHOOK] Token de segurança inválido.`);
          return res.status(200).json({ error: 'Acesso Negado' });
      }

      const event = req.body;
      
      // Ignora eventos que não são de pagamento confirmado
      if (event.event !== 'PAYMENT_CONFIRMED' && event.event !== 'PAYMENT_RECEIVED') {
        return res.status(200).json({ received: true, message: 'Ignorado' });
      }
      
      console.log(`[WEBHOOK] Processando Pagamento: ${event.payment?.id}`);

      const db = getFirebaseDB();
      if (!db) return res.status(500).json({ error: 'Database error' });

      const payment = event.payment;
      
      // --- LÓGICA DE NOTIFICAÇÃO AVULSA ---
      // Tenta obter o ID da notificação pelo externalReference ou Descrição
      let notificationId = payment.externalReference; 
      
      if (!notificationId && payment.description && payment.description.includes('Ref: ')) {
          try {
              notificationId = payment.description.split('Ref: ')[1].trim().split(' ')[0];
          } catch (e) {}
      }

      if (!notificationId) {
        console.error('[WEBHOOK] ID de referência da notificação não encontrado.');
        return res.status(200).json({ error: 'No Notification ID found' });
      }

      const docRef = db.collection('notificacoes').doc(notificationId);
      const docSnap = await docRef.get();

      if (!docSnap.exists) {
        return res.status(200).json({ error: 'Notificação não existe no banco' });
      }

      const notification = docSnap.data();
      const alreadySent = notification.status === 'Enviada' || notification.status === 'SENT';

      if (!alreadySent) {
          // 1. Atualiza Status Inicial
          await docRef.update({
              status: 'Enviada', 
              updatedAt: new Date().toISOString(),
              paymentId: payment.id,
              paymentDate: payment.paymentDate || new Date().toISOString(),
              paymentMethod: payment.billingType || 'ASAAS_WEBHOOK',
              emailStatus: 'SENT',
              whatsappStatus: 'SENT'
          });

          // 2. DISPAROS COM RASTREAMENTO AUTOMÁTICO
          const dispatchPromises = [];

          const officialSubject = `NOTIFICAÇÃO EXTRAJUDICIAL: ${notification.subject}`;
          const whatsappText = `*NOTIFICAÇÃO EXTRAJUDICIAL*\nRef: ${notification.subject}\n\nPrezado(a) ${notification.recipientName},\n\nEsta mensagem serve como comunicado oficial registrado na plataforma Notify.\n\nVocê possui um documento jurídico importante aguardando leitura. O teor completo, assinado digitalmente, encontra-se disponível no link abaixo:\n\n📄 *Acessar Documento:* ${notification.pdf_url}\n\nA ausência de manifestação poderá ser interpretada como silêncio para fins legais.\n\nAtenciosamente,\n*${notification.notificante_dados_expostos.nome}*\nCPF: ${notification.notificante_cpf}`;

          // A. EMAIL (SendGrid)
          const sgKey = process.env.SENDGRID_EMAIL_API_KEY || process.env.ENDGRID_EMAIL_API_KEY;
          if (notification.recipientEmail && sgKey) {
              const emailTask = async () => {
                  try {
                      sgMail.setApiKey(sgKey);
                      await sgMail.send({
                          to: notification.recipientEmail,
                          from: process.env.SENDGRID_FROM_EMAIL || 'notificacao@notify.ia.br',
                          subject: officialSubject,
                          html: `
                            <!DOCTYPE html>
                            <html>
                            <body style="margin: 0; padding: 0; font-family: Helvetica, Arial, sans-serif; background-color: #f4f4f5; color: #333;">
                                <div style="max-width: 600px; margin: 0 auto; background: #ffffff; padding: 40px; border-radius: 8px; margin-top: 20px; border: 1px solid #e2e8f0;">
                                    <h2 style="text-align:center">NOTIFICAÇÃO EXTRAJUDICIAL</h2>
                                    <p>Olá, <strong>${notification.recipientName}</strong>.</p>
                                    <p>Acesse seu documento no botão abaixo:</p>
                                    <div style="text-align: center; margin: 30px 0;">
                                        <a href="${notification.pdf_url}" style="background-color: #0F172A; color: #ffffff; padding: 16px 32px; text-decoration: none; border-radius: 6px; font-weight: bold;">
                                            ACESSAR DOCUMENTO
                                        </a>
                                    </div>
                                    <p style="font-size:12px; color:#999">Enviado por Notify.</p>
                                </div>
                            </body>
                            </html>
                          `,
                          custom_args: {
                              notificationId: notificationId
                          }
                      });
                      console.log('[WEBHOOK] Email enviado com sucesso.');
                  } catch (e) {
                      console.error('[WEBHOOK] Erro Email:', e.response?.body || e.message);
                  }
              };
              dispatchPromises.push(emailTask());
          }

          // B. WHATSAPP (Z-API)
          const zInstance = process.env.API_INSTANCE_ID || process.env.ZAPI_INSTANCE_ID;
          const zToken = process.env.API_INSTANCE_TOKEN || process.env.ZAPI_INSTANCE_TOKEN;
          
          if (notification.recipientPhone && zInstance && zToken) {
              const whatsTask = async () => {
                  try {
                      let cleanPhone = notification.recipientPhone.replace(/\D/g, '');
                      if (cleanPhone.length < 12) cleanPhone = '55' + cleanPhone;

                      const ZAPI_URL = `https://api.z-api.io/instances/${zInstance}/token/${zToken}`;
                      let zaapId = null;

                      if (notification.pdf_url) {
                          const resPdf = await fetch(`${ZAPI_URL}/send-document-pdf`, {
                              method: 'POST',
                              headers: { 'Content-Type': 'application/json' },
                              body: JSON.stringify({
                                  phone: cleanPhone,
                                  document: notification.pdf_url,
                                  fileName: "Notificacao_Extrajudicial.pdf",
                                  caption: whatsappText
                              })
                          });
                          const dataPdf = await resPdf.json();
                          if (resPdf.ok) zaapId = dataPdf.messageId || dataPdf.id;
                      }

                      if (!zaapId) {
                          const resText = await fetch(`${ZAPI_URL}/send-text`, {
                              method: 'POST',
                              headers: { 'Content-Type': 'application/json' },
                              body: JSON.stringify({
                                  phone: cleanPhone,
                                  message: whatsappText + `\n\nLink: ${notification.pdf_url}`
                              })
                          });
                          const dataText = await resText.json();
                          zaapId = dataText.messageId || dataText.id;
                      }

                      if (zaapId) {
                          await docRef.update({ whatsappMessageId: zaapId });
                      }

                  } catch (e) {
                      console.error('[WEBHOOK] Erro Whats:', e.message);
                  }
              };
              dispatchPromises.push(whatsTask());
          }

          if (dispatchPromises.length > 0) {
              await Promise.all(dispatchPromises);
          }
      }

      return res.status(200).json({ success: true });

  } catch (error) {
      console.error('[WEBHOOK] Erro Crítico:', error);
      return res.status(200).json({ error: 'Erro interno tratado', details: error.message });
  }
}
