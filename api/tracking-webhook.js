
import * as admin from 'firebase-admin';

function getFirebaseDB() {
    if (!admin.apps.length) {
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
    }
    return admin.firestore();
}

export default async function handler(req, res) {
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

    const db = getFirebaseDB();
    const payload = req.body;

    try {
        // --- 1. SENDGRID WEBHOOK (Array de Eventos) ---
        if (Array.isArray(payload)) {
            console.log(`[TRACKING] SendGrid Events: ${payload.length}`);
            
            for (const event of payload) {
                // Procuramos o custom_arg notificationId que injetamos no envio
                const notificationId = event.notificationId;
                
                if (notificationId) {
                    const updateData = {};
                    let shouldUpdate = false;

                    if (event.event === 'delivered') {
                        updateData.emailStatus = 'DELIVERED';
                        updateData.deliveredAt = new Date().toISOString();
                        shouldUpdate = true;
                    } else if (event.event === 'open') {
                        updateData.emailStatus = 'OPENED';
                        updateData.readAt = new Date().toISOString();
                        updateData.status = 'Lida'; // Atualiza status global
                        shouldUpdate = true;
                    } else if (event.event === 'click') {
                        updateData.emailStatus = 'CLICKED';
                        updateData.readAt = new Date().toISOString();
                        updateData.status = 'Lida';
                        shouldUpdate = true;
                    } else if (event.event === 'bounce' || event.event === 'dropped') {
                        updateData.emailStatus = 'BOUNCED';
                        shouldUpdate = true;
                    }

                    if (shouldUpdate) {
                        console.log(`[TRACKING] Atualizando E-mail Notif ${notificationId} para ${event.event}`);
                        await db.collection('notificacoes').doc(notificationId).set(updateData, { merge: true });
                    }
                }
            }
            return res.status(200).json({ received: true });
        }

        // --- 2. Z-API WEBHOOK (Objeto Único) ---
        // Z-API envia status, messageId, etc.
        // Evento esperado: on-message-status-change
        // Status: 3 (Entregue), 4 (Lido/Blue Tick)
        if (payload.messageId && payload.status) {
            console.log(`[TRACKING] Z-API Update: ${payload.messageId} -> Status ${payload.status}`);

            // Precisamos encontrar a notificação que tem esse whatsappMessageId
            const snapshot = await db.collection('notificacoes')
                .where('whatsappMessageId', '==', payload.messageId)
                .limit(1)
                .get();

            if (!snapshot.empty) {
                const doc = snapshot.docs[0];
                const currentData = doc.data();
                const updateData = {};
                let shouldUpdate = false;

                // Status Z-API: 
                // RECEIVED = Servidor recebeu
                // DELIVERED = Entregue no celular (2 ticks cinza)
                // READ = Lido (2 ticks azuis)
                
                const s = payload.status; 
                
                // Mapeamento Z-API pode vir como string ou numero dependendo da versão
                // Usualmente: 'DELIVERED', 'READ' ou códigos
                
                if (s === 'DELIVERED' || s === 'delivered' || s === 3) {
                    // Só atualiza se ainda não estiver LIDO
                    if (currentData.whatsappStatus !== 'READ') {
                        updateData.whatsappStatus = 'DELIVERED';
                        if (!currentData.deliveredAt) updateData.deliveredAt = new Date().toISOString();
                        // Se email tbm entregue, global = entregue
                        if (currentData.status !== 'Lida') updateData.status = 'Entregue';
                        shouldUpdate = true;
                    }
                } 
                else if (s === 'READ' || s === 'read' || s === 4) {
                    updateData.whatsappStatus = 'READ';
                    updateData.status = 'Lida'; // Global vira Lida
                    if (!currentData.readAt) updateData.readAt = new Date().toISOString();
                    shouldUpdate = true;
                }

                if (shouldUpdate) {
                    console.log(`[TRACKING] Atualizando WhatsApp Doc ${doc.id}`);
                    await doc.ref.set(updateData, { merge: true });
                }
            }
            return res.status(200).json({ received: true });
        }

        return res.status(200).json({ message: 'Ignored payload' });

    } catch (error) {
        console.error("[TRACKING] Erro:", error);
        return res.status(500).json({ error: error.message });
    }
}
