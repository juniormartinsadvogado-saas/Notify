
import sgMail from '@sendgrid/mail';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,POST');
  res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { recipientEmail, recipientName, subject, pdfUrl } = req.body;
  const apiKey = process.env.SENDGRID_EMAIL_API_KEY || process.env.ENDGRID_EMAIL_API_KEY;

  if (!apiKey) {
    console.error("[API/EMAIL] SENDGRID_EMAIL_API_KEY faltando.");
    return res.status(500).json({ error: 'Configuração de servidor incompleta.' });
  }

  sgMail.setApiKey(apiKey);
  const senderEmail = process.env.SENDGRID_FROM_EMAIL || 'notificacao@notify.ia.br';

  const plainTextContent = `
NOTIFICAÇÃO EXTRAJUDICIAL

Olá, ${recipientName}.

Você recebeu um comunicado formal referente ao assunto: ${subject}.

O documento completo, com validade jurídica e assinatura digital, encontra-se disponível para leitura imediata no link abaixo:

${pdfUrl}

Atenciosamente,
Plataforma Notify - Inteligência Jurídica
  `;

  const msg = {
    to: recipientEmail,
    from: {
        email: senderEmail,
        name: "Notify Jurídico"
    },
    subject: `NOTIFICAÇÃO EXTRAJUDICIAL: ${subject}`,
    text: plainTextContent, // Versão texto plano para evitar SPAM
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>Notificação Extrajudicial</title>
      </head>
      <body style="margin: 0; padding: 0; font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; background-color: #f4f4f5; color: #333;">
        <div style="max-width: 600px; margin: 0 auto; background: #ffffff; padding: 40px; border-radius: 8px; margin-top: 20px; border: 1px solid #e2e8f0;">
            <div style="text-align: center; margin-bottom: 30px;">
                <h2 style="color: #0F172A; margin: 0; font-size: 24px; text-transform: uppercase; letter-spacing: 1px;">Notificação Extrajudicial</h2>
                <p style="font-size: 14px; color: #64748b; margin-top: 5px;">Documento Oficial Registrado</p>
            </div>
            
            <p style="font-size: 16px; margin-bottom: 20px;">Olá, <strong>${recipientName}</strong>.</p>
            
            <p style="font-size: 15px; line-height: 1.6; margin-bottom: 20px; color: #334155;">
                Você recebeu um comunicado formal referente ao assunto: <strong>${subject}</strong>.
            </p>
            
            <p style="font-size: 15px; line-height: 1.6; margin-bottom: 30px; color: #334155;">
                O documento completo, com validade jurídica e assinatura digital, encontra-se disponível para leitura imediata através do botão abaixo:
            </p>
            
            <div style="text-align: center; margin-bottom: 40px;">
                <a href="${pdfUrl}" target="_blank" rel="noopener noreferrer" style="background-color: #0F172A; color: #ffffff; padding: 16px 32px; text-decoration: none; border-radius: 6px; font-weight: bold; font-size: 16px; display: inline-block; box-shadow: 0 4px 6px rgba(15, 23, 42, 0.1);">
                    ACESSAR DOCUMENTO (PDF)
                </a>
            </div>
            
            <p style="font-size: 13px; color: #64748b; line-height: 1.5; text-align: center;">
                Caso o botão não funcione, copie e cole o link abaixo no seu navegador:<br/>
                <a href="${pdfUrl}" style="color: #2563eb;">${pdfUrl}</a>
            </p>
            
            <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 30px 0;" />
            
            <p style="font-size: 12px; color: #94a3b8; text-align: center;">
                Enviado via Plataforma Notify - Inteligência Jurídica.<br/>
                Não responda a este e-mail automaticamente.
            </p>
        </div>
      </body>
      </html>
    `,
  };

  try {
    await sgMail.send(msg);
    return res.status(200).json({ success: true });
  } catch (error) {
    console.error("[API/EMAIL] Erro SendGrid:", error.response?.body || error.message);
    return res.status(500).json({ error: 'Falha ao enviar e-mail.', details: error.message });
  }
}
