
import { NotificationItem } from '../types';

export const dispatchCommunications = async (notification: NotificationItem) => {
    console.log(`[DISPARO] Iniciando sequência para Notificação ${notification.id}`);
    let successCount = 0;

    try {
        // 1. E-MAIL: ENVIO REAL VIA SENDGRID (Backend)
        if (notification.recipientEmail) {
            try {
                console.log("📨 Solicitando envio de e-mail (SendGrid)...");
                const response = await fetch('/api/email', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        recipientEmail: notification.recipientEmail,
                        recipientName: notification.recipientName,
                        subject: notification.subject,
                        pdfUrl: notification.pdf_url
                    }),
                });

                if (response.ok) {
                    console.log("✅ E-mail enviado!");
                    successCount++;
                } else {
                    const errData = await response.json();
                    console.error("❌ Erro SendGrid:", errData);
                }
            } catch (emailErr) {
                console.error("❌ Falha na conexão de e-mail:", emailErr);
            }
        }

        // 2. WHATSAPP: ENVIO REAL VIA Z-API (Backend)
        // Usamos o recipientPhone para enviar a mensagem
        if (notification.recipientPhone) {
            try {
                console.log("📱 Solicitando envio de WhatsApp (Z-API)...");
                
                const message = `Olá, ${notification.recipientName}.\n\nVocê recebeu uma Notificação Extrajudicial importante referente a: ${notification.subject}.\n\nPor favor, acesse o documento oficial no link abaixo para tomar ciência e evitar medidas judiciais.\n\nAtenciosamente,\n${notification.notificante_dados_expostos.nome}`;

                const response = await fetch('/api/whatsapp', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        phone: notification.recipientPhone,
                        message: message,
                        pdfUrl: notification.pdf_url,
                        fileName: `Notificacao_${notification.id}.pdf`
                    }),
                });

                if (response.ok) {
                    console.log("✅ WhatsApp enviado!");
                    successCount++;
                } else {
                    const errData = await response.json();
                    console.error("❌ Erro Z-API:", errData);
                }
            } catch (zapErr) {
                console.error("❌ Falha na conexão Z-API:", zapErr);
            }
        }
        
        // Retorna true se pelo menos um canal funcionou
        return successCount > 0;
    } catch (error) {
        console.error("ERRO GERAL NO DISPARO:", error);
        return false;
    }
};
