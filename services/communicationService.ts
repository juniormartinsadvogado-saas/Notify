
import { NotificationItem } from '../types';
import { db } from './firebase';
import { doc, updateDoc } from 'firebase/firestore';

export const dispatchCommunications = async (notification: NotificationItem) => {
    console.log(`[DISPARO] Iniciando sequência para Notificação ${notification.id}`);
    let successCount = 0;
    
    // Objeto para atualizar IDs no banco caso seja um reenvio manual
    const updates: any = {};

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
                        pdfUrl: notification.pdf_url,
                        notificationId: notification.id // Importante para rastreio
                    }),
                });

                if (response.ok) {
                    console.log("✅ E-mail enviado!");
                    updates.emailStatus = 'SENT';
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
                
                const data = await response.json();

                if (response.ok) {
                    console.log("✅ WhatsApp enviado!");
                    updates.whatsappStatus = 'SENT';
                    if (data.messageId) {
                        updates.whatsappMessageId = data.messageId; // Salva ID para rastreio
                    }
                    successCount++;
                } else {
                    console.error("❌ Erro Z-API:", data);
                }
            } catch (zapErr) {
                console.error("❌ Falha na conexão Z-API:", zapErr);
            }
        }

        // Se houve sucesso e temos atualizações de metadados (ex: whatsappMessageId), salvamos no banco
        if (Object.keys(updates).length > 0) {
            try {
                const docRef = doc(db, 'notificacoes', notification.id);
                await updateDoc(docRef, updates);
            } catch (e) {
                console.error("Erro ao salvar metadados de envio:", e);
            }
        }
        
        return successCount > 0;
    } catch (error) {
        console.error("ERRO GERAL NO DISPARO:", error);
        return false;
    }
};
