
import * as admin from 'firebase-admin';
import sgMail from '@sendgrid/mail';

// Inicialização segura do Firebase Admin
function getFirebaseDB() {
    const firebasePkg = admin.default || admin;
    if (!firebasePkg.apps?.length) {
        try {
            const privateKey = process.env.FIREBASE_PRIVATE_KEY 
                ? process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n')
                : undefined;

            firebasePkg.initializeApp({
                credential: firebasePkg.credential.cert({
                    projectId: process.env.FIREBASE_PROJECT_ID,
                    clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
                    privateKey: privateKey,
                }),
                storageBucket: "notify-jma.firebasestorage.app"
            });
        } catch (error) {
            console.error('[VALIDATE INIT] Erro Firebase:', error);
            return null;
        }
    }
    return firebasePkg.firestore();
}

export default async function handler(req, res) {
    // Headers CORS
    res.setHeader('Access-Control-Allow-Credentials', true);
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,POST');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

    const { paymentId } = req.body;
    const apiKey = process.env.ASAAS_PAGAMENTO_API_KEY;
    const asaasUrl = process.env.ASAAS_API_URL || 'https://www.asaas.com/api/v3';

    if (!paymentId || !apiKey) {
        return res.status(400).json({ error: "Dados insuficientes." });
    }

    try {
        // 1. Consulta Direta ao Asaas (FONTE DA VERDADE)
        const asaasResponse = await fetch(`${asaasUrl}/payments/${paymentId}`, {
            method: 'GET',
            headers: { 'access_token': apiKey }
        });

        const paymentData = await asaasResponse.json();

        if (!asaasResponse.ok) {
            console.error("[VALIDATE] Erro Asaas:", paymentData);
            throw new Error(paymentData.errors?.[0]?.description || "Erro na API Asaas.");
        }

        const status = paymentData.status;
        const isPaid = status === 'CONFIRMED' || status === 'RECEIVED' || status === 'PAYMENT_RECEIVED' || status === 'PAYMENT_CONFIRMED';

        // SE O ASAAS DIZ QUE ESTÁ PAGO, EXECUTAMOS O FLUXO COMPLETO (DB + ENVIOS)
        if (isPaid) {
            console.log(`[VALIDATE] Pagamento confirmado: ${paymentId}. Iniciando envios...`);
            
            const db = getFirebaseDB();
            if (!db) throw new Error("Falha DB");

            let notificationId = paymentData.externalReference;
            if (!notificationId && paymentData.description && paymentData.description.includes('Ref:')) {
                notificationId = paymentData.description.split('Ref:')[1].trim().split(' ')[0];
            }

            if (notificationId) {
                const docRef = db.collection('notificacoes').doc(notificationId);
                const docSnap = await docRef.get();
                
                if (docSnap.exists) {
                    const notification = docSnap.data();

                    // A. Atualiza Status DB
                    await docRef.set({
                        status: 'Enviada', 
                        updatedAt: new Date().toISOString(),
                        paymentId: paymentId,
                        paymentMethod: 'PIX_MANUAL_CHECK',
                        emailStatus: 'SENT', // Assume sucesso inicial para destravar UI
                        whatsappStatus: 'SENT'
                    }, { merge: true });

                    // B. Atualiza Transação
                    const txQuery = await db.collection('transactions').where('notificationId', '==', notificationId).get();
                    txQuery.forEach(t => t.ref.update({ status: 'Pago' }));

                    // C. PREPARAÇÃO DE DADOS DE ENVIO
                    const officialSubject = `NOTIFICAÇÃO EXTRAJUDICIAL - PROTOCOLO ${notificationId}`;
                    const cleanPhone = notification.recipientPhone ? notification.recipientPhone.replace(/\D/g, '') : '';
                    let whatsappNumber = cleanPhone;
                    if (whatsappNumber.length >= 10 && whatsappNumber.length <= 11) whatsappNumber = '55' + whatsappNumber;
                    else if (whatsappNumber.startsWith('0')) {
                        whatsappNumber = whatsappNumber.substring(1);
                        if (whatsappNumber.length <= 11) whatsappNumber = '55' + whatsappNumber;
                    }

                    const whatsappText = `*COMUNICADO OFICIAL - NOTIFY*\n\nPrezado(a) ${notification.recipientName},\n\nEmitimos uma Notificação Extrajudicial registrada sob o protocolo *${notificationId}*.\n\nEste documento possui validade jurídica e requer sua atenção imediata.\n\n📂 *Acesse o documento digital:* \n${notification.pdf_url}\n\nAtenciosamente,\n*${notification.notificante_dados_expostos.nome}*`;

                    const dispatchPromises = [];

                    // D. ENVIO EMAIL (SendGrid)
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
                                      <body style="font-family: Arial, sans-serif; background-color: #f8fafc; color: #334155; margin: 0; padding: 0;">
                                          <div style="max-width: 600px; margin: 20px auto; background: #fff; border: 1px solid #e2e8f0; border-radius: 8px;">
                                              <div style="background-color: #0f172a; padding: 20px; text-align: center; color: #fff;">
                                                  <h1 style="margin:0; font-size: 20px;">NOTIFICAÇÃO EXTRAJUDICIAL</h1>
                                                  <p style="margin:5px 0 0; font-size: 12px; color: #94a3b8;">Protocolo: ${notificationId}</p>
                                              </div>
                                              <div style="padding: 30px;">
                                                  <p>Olá, <strong>${notification.recipientName}</strong>.</p>
                                                  <p>Você recebeu um documento jurídico oficial referente a: <strong>${notification.subject}</strong>.</p>
                                                  <p style="text-align: center; margin: 30px 0;">
                                                      <a href="${notification.pdf_url}" style="background-color: #2563eb; color: #fff; padding: 12px 24px; text-decoration: none; border-radius: 4px; font-weight: bold;">ACESSAR DOCUMENTO</a>
                                                  </p>
                                                  <p style="font-size: 12px; color: #64748b; margin-top: 30px; border-top: 1px solid #eee; padding-top: 10px;">Link alternativo: ${notification.pdf_url}</p>
                                              </div>
                                          </div>
                                          <img src="https://notify.ia.br/api/pixel?id=${notificationId}" width="1" height="1" />
                                      </body>
                                      </html>
                                    `,
                                    custom_args: { notificationId: notificationId }
                                });
                                console.log('[VALIDATE] Email enviado.');
                            } catch (e) {
                                console.error('[VALIDATE] Erro Email:', e.message);
                            }
                        };
                        dispatchPromises.push(emailTask());
                    }

                    // E. ENVIO WHATSAPP (Z-API)
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
                                        }
                                    } catch (errPdf) {}
                                }

                                // Fallback Texto
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
                                console.log('[VALIDATE] WhatsApp processado.');

                            } catch (e) {
                                console.error('[VALIDATE] Erro WhatsApp:', e.message);
                            }
                        };
                        dispatchPromises.push(whatsTask());
                    }

                    await Promise.allSettled(dispatchPromises);
                }
            }

            return res.status(200).json({ paid: true, status: status, message: "Confirmado e enviado." });
        } else {
            return res.status(200).json({ paid: false, status: status });
        }

    } catch (error) {
        console.error("[MANUAL CHECK ERROR]", error);
        return res.status(500).json({ error: error.message });
    }
}
