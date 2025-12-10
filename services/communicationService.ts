import { NotificationItem } from '../types';

export const dispatchCommunications = async (notification: NotificationItem) => {
    console.log(`[DISPARO] Iniciando sequência para Notificação ${notification.id}`);

    try {
        // 1. E-MAIL: ENVIO REAL VIA VERCEL SERVERLESS FUNCTION
        // O frontend não envia email direto. Ele pede para a /api/email fazer isso.
        if (notification.recipientEmail) {
            try {
                console.log("📨 Solicitando envio de e-mail ao servidor...");
                const response = await fetch('/api/email', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        recipientEmail: notification.recipientEmail,
                        recipientName: notification.recipientName,
                        subject: notification.subject,
                        pdfUrl: notification.pdfUrl
                    }),
                });

                if (response.ok) {
                    console.log("✅ E-mail enviado com sucesso!");
                } else {
                    const errData = await response.json();
                    console.error("❌ Erro na API de E-mail:", errData);
                }
            } catch (emailErr) {
                console.error("❌ Erro de conexão com /api/email:", emailErr);
            }
        }

        // 2. SMS (MOCK / MODO DE TESTE) - Mantido local para evitar custos
        if (notification.recipientPhone) {
            await mockTwilioSMS(notification);
        }

        // 3. WHATSAPP (MOCK / MODO DE TESTE) - Mantido local para evitar custos
        if (notification.recipientPhone) {
            await mockTwilioWhatsApp(notification);
        }
        
        return true;
    } catch (error) {
        console.error("ERRO GERAL NO DISPARO:", error);
        return false;
    }
};

// --- SIMULADORES (MOCKS) ---
// Estas funções apenas imprimem no console o que "seria" enviado
const mockTwilioSMS = async (n: NotificationItem) => {
    console.log(`%c📱 [MOCK SMS] Para: ${n.recipientPhone}`, 'color: cyan; font-weight: bold;');
    console.log(`   Msg: "Notify: Voce recebeu um documento extrajudicial. Acesse: ${n.pdfUrl}"`);
    await new Promise(r => setTimeout(r, 600)); // Delay artificial
};

const mockTwilioWhatsApp = async (n: NotificationItem) => {
    console.log(`%c💬 [MOCK ZAP] Para: ${n.recipientPhone}`, 'color: green; font-weight: bold;');
    console.log(`   Template: notify_alert_v1 | Vars: {name: ${n.recipientName}, link: ${n.pdfUrl}}`);
    await new Promise(r => setTimeout(r, 600)); // Delay artificial
};