
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
      let notificationId = payment.externalReference; 
      
      // Fallback para encontrar ID na descrição
      if (!notificationId && payment.description && payment.description.includes('Ref: ')) {
          try {
              notificationId = payment.description.split('Ref: ')[1].trim().split(' ')[0];
          } catch (e) {}
      }

      if (!notificationId) {
        console.error('[WEBHOOK] ID da notificação não encontrado.');
        return res.status(200).json({ error: 'No ID found' });
      }

      const docRef = db.collection('notificacoes').doc(notificationId);
      const docSnap = await docRef.get();

      if (!docSnap.exists) {
        return res.status(200).json({ error: 'Notificação não existe no banco' });
      }

      const notification = docSnap.data();
      const alreadySent = notification.status === 'Enviada' || notification.status === 'SENT';

      if (!alreadySent) {
          // 1. Atualiza Notificação
          await docRef.update({
              status: 'Enviada', 
              updatedAt: new Date().toISOString(),
              paymentId: payment.id,
              paymentDate: payment.paymentDate || new Date().toISOString(),
              paymentMethod: payment.billingType || 'ASAAS_WEBHOOK'
          });

          // 2. Tenta ativar Reunião de Conciliação (Se houver uma 'canceled' recente para este user/destinatário)
          try {
             // Busca reuniões recentes deste host que estejam canceladas
             const meetingsRef = db.collection('reunioes');
             const qMeet = meetingsRef
                .where('hostUid', '==', notification.notificante_uid)
                .where('guestEmail', '==', notification.recipientEmail) // Vínculo pelo email do convidado
                .where('status', '==', 'canceled') // Assume que foi criada como canceled/pending
                .limit(1);
             
             const meetSnap = await qMeet.get();
             if (!meetSnap.empty) {
                 const meetDoc = meetSnap.docs[0];
                 await meetDoc.ref.update({ status: 'scheduled' });
                 console.log(`[WEBHOOK] Reunião ${meetDoc.id} ativada para Scheduled.`);
             }
          } catch (meetErr) {
              console.warn('[WEBHOOK] Erro ao ativar reunião:', meetErr);
          }

          // DISPAROS COM TEXTOS OFICIAIS
          const dispatchPromises = [];

          const officialSubject = `NOTIFICAÇÃO EXTRAJUDICIAL: ${notification.subject}`;
          
          // Texto WhatsApp (Curto e direto com Link)
          const whatsappText = `*NOTIFICAÇÃO EXTRAJUDICIAL*\nRef: ${notification.subject}\n\nPrezado(a) ${notification.recipientName},\n\nEsta mensagem serve como comunicado oficial registrado na plataforma Notify.\n\nVocê possui um documento jurídico importante aguardando leitura. O teor completo, assinado digitalmente, encontra-se disponível no link abaixo:\n\n📄 *Acessar Documento:* ${notification.pdf_url}\n\nA ausência de manifestação poderá ser interpretada como silêncio para fins legais.\n\nAtenciosamente,\n*${notification.notificante_dados_expostos.nome}*\nCPF: ${notification.notificante_cpf}`;

          // HTML E-mail (Formal)
          const emailHtml = `
            <div style="font-family: 'Helvetica Neue', Arial, sans-serif; color: #333; max-width: 650px; margin: 0 auto; border: 1px solid #e2e8f0; border-radius: 8px; overflow: hidden;">
                <div style="background-color: #0f172a; padding: 20px; text-align: center;">
                    <h2 style="color: #ffffff; margin: 0; font-size: 20px; letter-spacing: 1px;">NOTIFICAÇÃO EXTRAJUDICIAL</h2>
                </div>
                <div style="padding: 40px 30px; background-color: #ffffff;">
                    <p style="font-size: 14px; color: #64748b; margin-bottom: 20px;">Ref: <strong>${notification.subject}</strong></p>
                    
                    <p style="font-size: 16px; margin-bottom: 20px;">
                        Prezado(a) <strong>${notification.recipientName}</strong>,
                    </p>
                    
                    <p style="font-size: 15px; line-height: 1.6; margin-bottom: 20px; color: #334155;">
                        Serve a presente para notificá-lo(a) formalmente a respeito dos fatos e fundamentos jurídicos constantes no documento anexo, registrado eletronicamente em nossa plataforma segura.
                    </p>
                    
                    <p style="font-size: 15px; line-height: 1.6; margin-bottom: 30px; color: #334155;">
                        O documento possui assinatura digital e hash de verificação de autenticidade. Solicitamos que acesse o conteúdo integral imediatamente para evitar eventuais medidas judiciais cabíveis.
                    </p>

                    <div style="text-align: center; margin-bottom: 40px;">
                        <a href="${notification.pdf_url}" style="background-color: #ef4444; color: #ffffff; padding: 14px 32px; text-decoration: none; border-radius: 6px; font-weight: bold; font-size: 16px; display: inline-block; box-shadow: 0 4px 6px rgba(239, 68, 68, 0.2);">
                            LER NOTIFICAÇÃO COMPLETA (PDF)
                        </a>
                    </div>
                    
                    <hr style="border: none; border-top: 1px solid #e2e8f0; margin-bottom: 20px;">
                    
                    <p style="font-size: 12px; color: #94a3b8; text-align: center;">
                        Remetente: ${notification.notificante_dados_expostos.nome} (CPF: ***.${notification.notificante_cpf.substr(3,3)}.${notification.notificante_cpf.substr(6,3)}-**)<br/>
                        Este e-mail é gerado automaticamente pela plataforma Notify.
                    </p>
                </div>
            </div>
          `;

          // 1. EMAIL (SendGrid)
          const sgKey = process.env.SENDGRID_EMAIL_API_KEY || process.env.ENDGRID_EMAIL_API_KEY;
          if (notification.recipientEmail && sgKey) {
              const emailTask = async () => {
                  try {
                      sgMail.setApiKey(sgKey);
                      await sgMail.send({
                          to: notification.recipientEmail,
                          from: process.env.SENDGRID_FROM_EMAIL || 'notificacao@notify.ia.br',
                          subject: officialSubject,
                          html: emailHtml
                      });
                      console.log('[WEBHOOK] Email enviado com sucesso.');
                  } catch (e) {
                      console.error('[WEBHOOK] Erro Email:', e.response?.body || e.message);
                  }
              };
              dispatchPromises.push(emailTask());
          }

          // 2. WHATSAPP (Z-API)
          const zInstance = process.env.API_INSTANCE_ID || process.env.ZAPI_INSTANCE_ID;
          const zToken = process.env.API_INSTANCE_TOKEN || process.env.ZAPI_INSTANCE_TOKEN;
          
          if (notification.recipientPhone && zInstance && zToken) {
              const whatsTask = async () => {
                  try {
                      let cleanPhone = notification.recipientPhone.replace(/\D/g, '');
                      if (cleanPhone.length < 12) cleanPhone = '55' + cleanPhone;

                      const ZAPI_URL = `https://api.z-api.io/instances/${zInstance}/token/${zToken}`;
                      
                      // Tenta enviar PDF primeiro
                      if (notification.pdf_url) {
                          const resPdf = await fetch(`${ZAPI_URL}/send-document-pdf`, {
                              method: 'POST',
                              headers: { 'Content-Type': 'application/json' },
                              body: JSON.stringify({
                                  phone: cleanPhone,
                                  document: notification.pdf_url,
                                  fileName: "Notificacao_Extrajudicial.pdf",
                                  caption: whatsappText // Texto vai na legenda do PDF
                              })
                          });
                          
                          if (resPdf.ok) {
                              console.log('[WEBHOOK] WhatsApp PDF enviado.');
                              return;
                          }
                      }

                      // Fallback: Envia Texto com Link
                      await fetch(`${ZAPI_URL}/send-text`, {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({
                              phone: cleanPhone,
                              message: whatsappText + `\n\nLink: ${notification.pdf_url}`
                          })
                      });
                      console.log('[WEBHOOK] WhatsApp Texto enviado.');

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
