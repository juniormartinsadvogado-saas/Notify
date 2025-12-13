
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
      
      console.log(`[WEBHOOK] Processando Pagamento Confirmado: ${event.payment?.id}`);

      const db = getFirebaseDB();
      if (!db) return res.status(500).json({ error: 'Database error' });

      const payment = event.payment;
      
      // --- 1. IDENTIFICAÇÃO DA NOTIFICAÇÃO ---
      let notificationId = payment.externalReference; 
      
      if (!notificationId && payment.description && payment.description.includes('Ref:')) {
          try {
              const parts = payment.description.split('Ref:');
              if (parts.length > 1) {
                  notificationId = parts[1].trim().split(' ')[0]; 
              }
          } catch (e) {
              console.error('[WEBHOOK] Erro ao parsear descrição:', e);
          }
      }

      if (!notificationId) {
        console.error('[WEBHOOK] ID de referência da notificação não encontrado no pagamento.');
        return res.status(200).json({ error: 'No Notification ID found' });
      }

      console.log(`[WEBHOOK] Notificação Alvo: ${notificationId}`);

      const docRef = db.collection('notificacoes').doc(notificationId);
      const docSnap = await docRef.get();

      if (!docSnap.exists) {
        console.error('[WEBHOOK] Documento da notificação não existe no Firestore.');
        return res.status(200).json({ error: 'Notificação não existe no banco' });
      }

      const notification = docSnap.data();
      
      // --- 2. ATUALIZAÇÃO DE STATUS (CRÍTICO) ---
      
      const batch = db.batch();

      // A. Atualiza Notificação -> ENVIADA
      batch.update(docRef, {
          status: 'Enviada', 
          updatedAt: new Date().toISOString(),
          paymentId: payment.id,
          paymentDate: payment.paymentDate || new Date().toISOString(),
          paymentMethod: payment.billingType || 'ASAAS_WEBHOOK',
          emailStatus: 'SENT', 
          whatsappStatus: 'SENT'
      });

      // B. Atualiza Transação -> PAGO (Tira da aba pendente)
      const txQuery = await db.collection('transactions')
          .where('notificationId', '==', notificationId)
          .get();

      if (!txQuery.empty) {
          txQuery.forEach(txDoc => {
              batch.update(txDoc.ref, { status: 'Pago' });
              console.log(`[WEBHOOK] Atualizando transação ${txDoc.id} para Pago.`);
          });
      }

      // C. Atualiza Reunião (Se houver) -> CONFIRMADA
      const meetingsSnap = await db.collection('reunioes')
          .where('hostUid', '==', notification.notificante_uid)
          .where('status', '==', 'pending')
          .orderBy('createdAt', 'desc')
          .limit(1)
          .get();

      if (!meetingsSnap.empty) {
          const meetingDoc = meetingsSnap.docs[0];
          batch.update(meetingDoc.ref, { status: 'scheduled' });
      }

      await batch.commit();
      console.log('[WEBHOOK] Status atualizados no Firestore.');

      // --- 3. DISPAROS DE COMUNICAÇÃO ---
      
      const officialSubject = `NOTIFICAÇÃO EXTRAJUDICIAL - PROTOCOLO ${notificationId}`;
      const cleanPhone = notification.recipientPhone ? notification.recipientPhone.replace(/\D/g, '') : '';
      
      // Ajuste Fino Telefone
      let whatsappNumber = cleanPhone;
      if (whatsappNumber.length >= 10 && whatsappNumber.length <= 11) {
          whatsappNumber = '55' + whatsappNumber;
      } else if (whatsappNumber.startsWith('0')) {
          whatsappNumber = whatsappNumber.substring(1);
          if (whatsappNumber.length <= 11) whatsappNumber = '55' + whatsappNumber;
      }

      const whatsappText = `*COMUNICADO OFICIAL - NOTIFY*\n\nPrezado(a) ${notification.recipientName},\n\nEmitimos uma Notificação Extrajudicial registrada sob o protocolo *${notificationId}*.\n\nEste documento possui validade jurídica e requer sua atenção imediata.\n\n📂 *Acesse o documento digital:* \n${notification.pdf_url}\n\nAtenciosamente,\n*${notification.notificante_dados_expostos.nome}*`;

      const dispatchPromises = [];

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
                        <html lang="pt-BR">
                        <body style="margin: 0; padding: 0; font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; background-color: #f8fafc; color: #334155;">
                            <div style="max-width: 600px; margin: 40px auto; background: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06); border: 1px solid #e2e8f0;">
                                <div style="background-color: #0f172a; padding: 30px; text-align: center;">
                                    <h1 style="color: #ffffff; margin: 0; font-size: 20px; letter-spacing: 1px; font-weight: 600;">NOTIFICAÇÃO EXTRAJUDICIAL</h1>
                                    <p style="color: #94a3b8; font-size: 12px; margin-top: 8px; text-transform: uppercase;">Protocolo Digital: ${notificationId}</p>
                                </div>
                                
                                <div style="padding: 40px;">
                                    <p style="font-size: 16px; margin-bottom: 24px;">Olá, <strong>${notification.recipientName}</strong>.</p>
                                    
                                    <p style="font-size: 15px; line-height: 1.6; margin-bottom: 24px; color: #475569;">
                                        Você recebeu um comunicado formal via plataforma Notify. Este documento foi registrado e possui validade jurídica para todos os fins.
                                    </p>
                                    
                                    <div style="background-color: #f1f5f9; border-left: 4px solid #3b82f6; padding: 16px; margin-bottom: 30px; border-radius: 4px;">
                                        <p style="margin: 0; font-size: 14px; font-weight: 600; color: #1e293b;">Assunto: ${notification.subject}</p>
                                        <p style="margin: 5px 0 0; font-size: 13px; color: #64748b;">Remetente: ${notification.notificante_dados_expostos.nome}</p>
                                    </div>

                                    <div style="text-align: center; margin: 35px 0;">
                                        <a href="${notification.pdf_url}" target="_blank" style="background-color: #2563eb; color: #ffffff; padding: 16px 32px; text-decoration: none; border-radius: 8px; font-weight: bold; font-size: 16px; display: inline-block; transition: background-color 0.2s;">
                                            LER DOCUMENTO COMPLETO
                                        </a>
                                    </div>
                                    
                                    <p style="font-size: 12px; color: #94a3b8; text-align: center; margin-top: 40px; border-top: 1px solid #e2e8f0; padding-top: 20px;">
                                        Este e-mail foi enviado automaticamente pela plataforma Notify Jurídica.<br>
                                        Segurança e validade garantidas por assinatura digital.
                                    </p>
                                </div>
                            </div>
                        </body>
                        </html>
                      `,
                      custom_args: { notificationId: notificationId }
                  });
                  console.log('[WEBHOOK] Email enviado via SendGrid.');
              } catch (e) {
                  console.error('[WEBHOOK] Erro Email:', e.response?.body || e.message);
              }
          };
          dispatchPromises.push(emailTask());
      }

      // B. WHATSAPP (Z-API)
      const zInstance = process.env.API_INSTANCE_ID || process.env.ZAPI_INSTANCE_ID;
      const zToken = process.env.API_INSTANCE_TOKEN || process.env.ZAPI_INSTANCE_TOKEN;
      
      if (whatsappNumber && zInstance && zToken) {
          const whatsTask = async () => {
              try {
                  const ZAPI_ENDPOINT = `https://api.z-api.io/instances/${zInstance}/token/${zToken}`;
                  let zaapId = null;

                  // Tenta PDF
                  if (notification.pdf_url) {
                      try {
                          const resPdf = await fetch(`${ZAPI_ENDPOINT}/send-document-pdf`, {
                              method: 'POST',
                              headers: { 'Content-Type': 'application/json' },
                              body: JSON.stringify({
                                  phone: whatsappNumber,
                                  document: notification.pdf_url,
                                  fileName: `Notificacao_${notificationId}.pdf`,
                                  caption: whatsappText
                              })
                          });
                          const dataPdf = await resPdf.json();
                          if (resPdf.ok && (dataPdf.messageId || dataPdf.id)) {
                              zaapId = dataPdf.messageId || dataPdf.id;
                              console.log('[WEBHOOK] PDF WhatsApp enviado.');
                          }
                      } catch (errPdf) {
                          console.error("[WEBHOOK] Erro PDF Whats:", errPdf.message);
                      }
                  }

                  // Fallback Texto (garante entrega do link)
                  if (!zaapId) {
                      const resText = await fetch(`${ZAPI_ENDPOINT}/send-text`, {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({
                              phone: whatsappNumber,
                              message: whatsappText + `\n\nLink: ${notification.pdf_url}`
                          })
                      });
                      const dataText = await resText.json();
                      if (resText.ok) zaapId = dataText.messageId || dataText.id;
                  }

                  if (zaapId) await docRef.update({ whatsappMessageId: zaapId });

              } catch (e) {
                  console.error('[WEBHOOK] Erro Crítico WhatsApp:', e.message);
              }
          };
          dispatchPromises.push(whatsTask());
      }

      if (dispatchPromises.length > 0) {
          await Promise.allSettled(dispatchPromises);
      }

      return res.status(200).json({ success: true });

  } catch (error) {
      console.error('[WEBHOOK] Erro Geral:', error);
      return res.status(200).json({ error: 'Erro interno processado', details: error.message });
  }
}
