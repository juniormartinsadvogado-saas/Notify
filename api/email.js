
import sgMail from '@sendgrid/mail';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,POST');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { recipientEmail, recipientName, subject, pdfUrl, notificationId } = req.body;
  const apiKey = process.env.SENDGRID_EMAIL_API_KEY || process.env.ENDGRID_EMAIL_API_KEY;

  if (!apiKey) return res.status(500).json({ error: 'Server Config Error' });

  sgMail.setApiKey(apiKey);
  
  // Utiliza um remetente verificado (importante para não cair no spam)
  const senderEmail = process.env.SENDGRID_FROM_EMAIL || 'notificacao@notify.ia.br';

  const plainText = `
    NOTIFICAÇÃO EXTRAJUDICIAL
    Protocolo: ${notificationId || 'N/A'}
    
    Prezado(a) ${recipientName},
    
    Você recebeu um documento jurídico oficial referente a: ${subject}.
    
    Para acessar o conteúdo integral e assinado digitalmente, clique no link abaixo:
    ${pdfUrl}
    
    Este é um aviso automático da plataforma Notify.
  `;

  const msg = {
    to: recipientEmail,
    from: {
        email: senderEmail,
        name: "Notify Jurídico"
    },
    subject: `NOTIFICAÇÃO EXTRAJUDICIAL: ${subject}`,
    text: plainText, // Versão texto puro é crucial para anti-spam
    html: `
      <!DOCTYPE html>
      <html lang="pt-BR">
      <head>
        <meta charset="utf-8">
        <title>Notificação Extrajudicial</title>
      </head>
      <body style="margin:0; padding:0; font-family: Helvetica, Arial, sans-serif; background-color:#f8fafc; color:#334155;">
        <div style="max-width:600px; margin:40px auto; background:#ffffff; border-radius:8px; border:1px solid #e2e8f0; overflow:hidden;">
            <div style="background-color:#0f172a; padding:30px; text-align:center;">
                <h1 style="color:#ffffff; font-size:20px; margin:0;">NOTIFICAÇÃO EXTRAJUDICIAL</h1>
                <p style="color:#94a3b8; font-size:12px; margin-top:5px; text-transform:uppercase;">Protocolo: ${notificationId || 'N/A'}</p>
            </div>
            <div style="padding:40px;">
                <p style="font-size:16px;">Prezado(a) <strong>${recipientName}</strong>,</p>
                <p style="font-size:15px; line-height:1.6; color:#475569;">Informamos que foi emitido um documento de teor jurídico referente ao assunto: <strong>${subject}</strong>.</p>
                <div style="text-align:center; margin:35px 0;">
                    <a href="${pdfUrl}" style="background-color:#2563eb; color:#ffffff; padding:14px 28px; text-decoration:none; border-radius:6px; font-weight:bold; font-size:15px;">ACESSAR DOCUMENTO</a>
                </div>
                <p style="font-size:12px; color:#94a3b8; text-align:center; margin-top:30px; border-top:1px solid #e2e8f0; padding-top:20px;">
                    Link direto: <a href="${pdfUrl}" style="color:#2563eb;">${pdfUrl}</a>
                </p>
            </div>
        </div>
      </body>
      </html>
    `,
    trackingSettings: {
        clickTracking: { enable: true },
        openTracking: { enable: true }
    },
    custom_args: { notificationId: notificationId || "unknown" }
  };

  try {
    await sgMail.send(msg);
    return res.status(200).json({ success: true });
  } catch (error) {
    console.error("SendGrid Error:", error.response?.body || error.message);
    return res.status(500).json({ error: error.message });
  }
}
