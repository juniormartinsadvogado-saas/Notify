
import { NotificationItem } from '../types';
import { db } from './firebase';
import { doc, updateDoc } from 'firebase/firestore';

export const dispatchCommunications = async (notification: NotificationItem) => {
    console.log(`[DISPARO] Iniciando para ${notification.id}`);
    const updates: any = {};
    let success = false;

    if (notification.recipientEmail) {
        try {
            const res = await fetch('/api/email', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    recipientEmail: notification.recipientEmail,
                    recipientName: notification.recipientName || 'Destinatário',
                    subject: notification.subject,
                    pdfUrl: notification.pdf_url,
                    notificationId: notification.id
                }),
            });
            if (res.ok) { updates.emailStatus = 'SENT'; success = true; }
        } catch (e) { console.error("Erro Email:", e); }
    }

    if (notification.recipientPhone) {
        try {
            const res = await fetch('/api/whatsapp', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    phone: notification.recipientPhone,
                    message: `Olá, ${notification.recipientName}. Você recebeu uma Notificação Extrajudicial (Ref: ${notification.subject}).`,
                    pdfUrl: notification.pdf_url,
                    fileName: `Notificacao_${notification.id}.pdf`
                }),
            });
            const data = await res.json();
            if (res.ok) { 
                updates.whatsappStatus = 'SENT'; 
                if (data.messageId) updates.whatsappMessageId = data.messageId;
                success = true; 
            }
        } catch (e) { console.error("Erro Whats:", e); }
    }

    if (Object.keys(updates).length > 0) {
        try { await updateDoc(doc(db, 'notificacoes', notification.id), updates); } catch (e) {}
    }
    return success;
};
