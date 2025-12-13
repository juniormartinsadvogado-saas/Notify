
import * as admin from 'firebase-admin';
import sgMail from '@sendgrid/mail';

// Função auxiliar para inicializar o DB de forma segura
function getFirebaseDB() {
    if (!admin.apps.length) {
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
                console.error("[VALIDATE INIT] Faltam variáveis de ambiente do Firebase.");
                return null;
            }

            admin.initializeApp({
                credential: admin.credential.cert(serviceAccount),
                storageBucket: "notify-jma.firebasestorage.app"
            });
        } catch (error) {
            console.error('[VALIDATE INIT] Erro Firebase:', error);
            return null;
        }
    }
    return admin.firestore();
}

export default async function handler(req, res) {
    // CORS Configuration
    res.setHeader('Access-Control-Allow-Credentials', true);
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,POST');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

    const { paymentId } = req.body;
    const apiKey = process.env.ASAAS_PAGAMENTO_API_KEY;

    if (!paymentId || !apiKey) {
        return res.status(400).json({ error: "Dados insuficientes." });
    }

    try {
        // 1. Consulta Direta ao Asaas (Fura a fila do Webhook)
        const asaasResponse = await fetch(`https://www.asaas.com/api/v3/payments/${paymentId}`, {
            method: 'GET',
            headers: { 'access_token': apiKey }
        });

        const paymentData = await asaasResponse.json();

        if (!asaasResponse.ok) {
            throw new Error(paymentData.errors?.[0]?.description || "Erro ao consultar Asaas.");
        }

        // 2. Verifica Status Real
        const status = paymentData.status;
        const isPaid = status === 'CONFIRMED' || status === 'RECEIVED' || status === 'PAYMENT_RECEIVED' || status === 'PAYMENT_CONFIRMED';

        if (isPaid) {
            const db = getFirebaseDB();
            if (db) {
                const notificationId = paymentData.externalReference;
                if (notificationId) {
                    const docRef = db.collection('notificacoes').doc(notificationId);
                    const docSnap = await docRef.get();

                    if (docSnap.exists) {
                        const notification = docSnap.data();
                        const alreadySent = notification.status === 'Enviada' || notification.status === 'SENT';

                        // 3. Atualiza Status e DISPARA COMUNICAÇÕES (MESMO SE JÁ FOI, PARA GARANTIR RETENTATIVA)
                        // A lógica aqui é duplicada do webhook propositalmente para garantir o envio imediato
                        // caso o webhook demore.
                        
                        await docRef.set({
                            status: 'Enviada', 
                            updatedAt: new Date().toISOString(),
                            paymentId: paymentId,
                            paymentMethod: 'PIX_MANUAL_CHECK'
                        }, { merge: true });

                        if (!alreadySent) {
                            console.log(`[VALIDATE] Disparando notificações para ${notificationId}...`);
                            
                            // A. EMAIL (SendGrid)
                            const sgKey = process.env.SENDGRID_EMAIL_API_KEY || process.env.ENDGRID_EMAIL_API_KEY;
                            if (notification.recipientEmail && sgKey) {
                                try {
                                    sgMail.setApiKey(sgKey);
                                    await sgMail.send({
                                        to: notification.recipientEmail,
                                        from: process.env.SENDGRID_FROM_EMAIL || 'notificacao@notify.ia.br',
                                        subject: `NOTIFICAÇÃO EXTRAJUDICIAL: ${notification.subject}`,
                                        html: `
                                            <div style="font-family: Arial, sans-serif; padding: 20px; color: #333;">
                                                <h2 style="color: #0F172A;">NOTIFICAÇÃO EXTRAJUDICIAL</h2>
                                                <p>Olá, <strong>${notification.recipientName}</strong>.</p>
                                                <p>Você recebeu um comunicado oficial. Acesse abaixo:</p>
                                                <br/>
                                                <a href="${notification.pdf_url}" style="background-color: #0F172A; color: #fff; padding: 12px 24px; text-decoration: none; border-radius: 5px; font-weight: bold;">ACESSAR DOCUMENTO</a>
                                                <br/><br/>
                                                <p style="font-size: 12px; color: #666;">Enviado via Plataforma Notify.</p>
                                            </div>
                                        `,
                                        custom_args: { notificationId: notificationId }
                                    });
                                    await docRef.update({ emailStatus: 'SENT' });
                                } catch (err) { console.error("[VALIDATE] Erro Email:", err.message); }
                            }

                            // B. WHATSAPP (Z-API)
                            const zInstance = process.env.API_INSTANCE_ID || process.env.ZAPI_INSTANCE_ID;
                            const zToken = process.env.API_INSTANCE_TOKEN || process.env.ZAPI_INSTANCE_TOKEN;
                            
                            if (notification.recipientPhone && zInstance && zToken) {
                                try {
                                    let cleanPhone = notification.recipientPhone.replace(/\D/g, '');
                                    if (cleanPhone.length < 12) cleanPhone = '55' + cleanPhone;
                                    
                                    const ZAPI_URL = `https://api.z-api.io/instances/${zInstance}/token/${zToken}`;
                                    const whatsappText = `*NOTIFICAÇÃO EXTRAJUDICIAL*\n\nPrezado(a) ${notification.recipientName},\n\nAcesse seu documento oficial no link abaixo:\n\n📄 ${notification.pdf_url}`;

                                    // Tenta enviar PDF direto, fallback para texto
                                    let zaapId = null;
                                    if (notification.pdf_url) {
                                        const resPdf = await fetch(`${ZAPI_URL}/send-document-pdf`, {
                                            method: 'POST',
                                            headers: { 'Content-Type': 'application/json' },
                                            body: JSON.stringify({ phone: cleanPhone, document: notification.pdf_url, fileName: "Notificacao.pdf", caption: whatsappText })
                                        });
                                        const d = await resPdf.json();
                                        if (resPdf.ok) zaapId = d.messageId || d.id;
                                    }

                                    if (!zaapId) {
                                        const resText = await fetch(`${ZAPI_URL}/send-text`, {
                                            method: 'POST',
                                            headers: { 'Content-Type': 'application/json' },
                                            body: JSON.stringify({ phone: cleanPhone, message: whatsappText })
                                        });
                                        const d = await resText.json();
                                        zaapId = d.messageId || d.id;
                                    }

                                    if (zaapId) await docRef.update({ whatsappMessageId: zaapId, whatsappStatus: 'SENT' });

                                } catch (err) { console.error("[VALIDATE] Erro Z-API:", err.message); }
                            }
                        }
                    }
                }
            }
            return res.status(200).json({ paid: true, status: status });
        } else {
            return res.status(200).json({ paid: false, status: status });
        }

    } catch (error) {
        console.error("[MANUAL CHECK ERROR]", error);
        return res.status(500).json({ error: error.message });
    }
}
