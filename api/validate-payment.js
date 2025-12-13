
import * as admin from 'firebase-admin';
import sgMail from '@sendgrid/mail';

// Inicialização segura do Firebase Admin
function getFirebaseDB() {
    if (!admin.apps.length) {
        try {
            const privateKey = process.env.FIREBASE_PRIVATE_KEY 
                ? process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n')
                : undefined;

            admin.initializeApp({
                credential: admin.credential.cert({
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
    return admin.firestore();
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
            // Log detalhado para debug se falhar
            console.error("[VALIDATE] Erro Asaas:", paymentData);
            throw new Error(paymentData.errors?.[0]?.description || "Erro na API Asaas.");
        }

        const status = paymentData.status;
        const isPaid = status === 'CONFIRMED' || status === 'RECEIVED' || status === 'PAYMENT_RECEIVED' || status === 'PAYMENT_CONFIRMED';

        // SE O ASAAS DIZ QUE ESTÁ PAGO, RETORNAMOS TRUE IMEDIATAMENTE PARA A UI
        if (isPaid) {
            console.log(`[VALIDATE] Pagamento confirmado: ${paymentId}`);
            
            try {
                const db = getFirebaseDB();
                if (db) {
                    let notificationId = paymentData.externalReference;
                    if (!notificationId && paymentData.description && paymentData.description.includes('Ref:')) {
                        notificationId = paymentData.description.split('Ref:')[1].trim().split(' ')[0];
                    }

                    if (notificationId) {
                        const docRef = db.collection('notificacoes').doc(notificationId);
                        
                        // Atualiza status
                        await docRef.set({
                            status: 'Enviada', 
                            updatedAt: new Date().toISOString(),
                            paymentId: paymentId,
                            paymentMethod: 'PIX_MANUAL_CHECK'
                        }, { merge: true });

                        console.log(`[VALIDATE] DB Atualizado para notificação ${notificationId}`);
                    }
                }
            } catch (dbError) {
                console.error("[VALIDATE] Erro ao atualizar DB (mas pagamento foi confirmado):", dbError);
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
