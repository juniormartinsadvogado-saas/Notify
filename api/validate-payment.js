
import * as admin from 'firebase-admin';

// Inicialização segura do Firebase Admin (Mesma lógica robusta do Webhook)
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
    // CORS
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
            // 3. Se pago, força atualização no Firebase
            const db = getFirebaseDB();
            if (db) {
                const notificationId = paymentData.externalReference;
                if (notificationId) {
                    await db.collection('notificacoes').doc(notificationId).set({
                        status: 'Enviada', // Força status de sucesso
                        updatedAt: new Date().toISOString(),
                        paymentId: paymentId,
                        paymentMethod: 'PIX_MANUAL_CHECK'
                    }, { merge: true });
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
