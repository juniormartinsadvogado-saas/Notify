
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

  const msg = {
    to: recipientEmail,
    from: senderEmail,
    subject: `NOTIFICAÇÃO EXTRAJUDICIAL: ${subject}`,
    html: `
      <!DOCTYPE html>
      <html>
      <body style="margin: 0; padding: 0; font-family: sans-serif; background-color: #f4f4f5;">
        <div style="max-width: 600px; margin: 0 auto; background: white; padding: 40px; border-radius: 8px; margin-top: 20px;">
            <h2 style="color: #0F172A; margin-top: 0;">Notificação Extrajudicial</h2>
            <p style="color: #555;">Olá, <strong>${recipientName}</strong>.</p>
            <p style="color: #555; line-height: 1.5;">Você possui uma notificação importante sobre: <strong>${subject}</strong>.</p>
            <p style="color: #555;">Este documento foi registrado e possui validade jurídica. Acesse abaixo:</p>
            <br/>
            <a href="${pdfUrl}" style="background-color: #0F172A; color: white; padding: 15px 30px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block;">Ler Documento (PDF)</a>
            <br/><br/>
            <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;" />
            <p style="font-size: 12px; color: #999; text-align: center;">Enviado via Plataforma Notify.</p>
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
