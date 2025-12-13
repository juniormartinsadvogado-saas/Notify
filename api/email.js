
import sgMail from '@sendgrid/mail';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,POST');
  res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { recipientEmail, recipientName, subject, pdfUrl, notificationId } = req.body;
  const apiKey = process.env.SENDGRID_EMAIL_API_KEY || process.env.ENDGRID_EMAIL_API_KEY;

  if (!apiKey) {
    return res.status(500).json({ error: 'Configuração de servidor incompleta.' });
  }

  sgMail.setApiKey(apiKey);
  const senderEmail = process.env.SENDGRID_FROM_EMAIL || 'notificacao@notify.ia.br';

  const msg = {
    to: recipientEmail,
    from: {
        email: senderEmail,
        name: "Notify Jurídico"
    },
    subject: `NOTIFICAÇÃO EXTRAJUDICIAL: ${subject}`,
    text: `Olá ${recipientName}, você recebeu uma notificação extrajudicial. Acesse o documento completo aqui: ${pdfUrl}`,
    html: `
      <!DOCTYPE html>
      <html lang="pt-BR">
      <head>
        <meta charset="utf-8">
        <title>Notificação Extrajudicial</title>
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
      </head>
      <body style="margin: 0; padding: 0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f1f5f9; color: #1e293b;">
        <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="min-width: 100%;">
            <tr>
                <td align="center" style="padding: 40px 0;">
                    <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="600" style="background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.05); border: 1px solid #e2e8f0;">
                        <!-- Header -->
                        <tr>
                            <td align="center" style="background-color: #0f172a; padding: 30px;">
                                <h1 style="color: #ffffff; font-size: 22px; margin: 0; font-weight: 700; letter-spacing: 0.5px;">NOTIFICAÇÃO EXTRAJUDICIAL</h1>
                                <p style="color: #94a3b8; font-size: 12px; margin-top: 8px; text-transform: uppercase;">Protocolo Digital: <strong>${notificationId || 'N/A'}</strong></p>
                            </td>
                        </tr>
                        
                        <!-- Content -->
                        <tr>
                            <td style="padding: 40px 40px 20px 40px;">
                                <p style="font-size: 16px; margin-bottom: 20px;">Prezado(a) <strong>${recipientName}</strong>,</p>
                                
                                <p style="font-size: 15px; line-height: 1.6; color: #475569; margin-bottom: 25px;">
                                    Informamos que foi emitido um documento de teor jurídico referente ao assunto: <strong>${subject}</strong>.
                                </p>
                                
                                <p style="font-size: 15px; line-height: 1.6; color: #475569; margin-bottom: 35px;">
                                    Para tomar ciência do conteúdo integral, bem como dos prazos e medidas legais cabíveis, acesse o documento original assinado digitalmente através do botão abaixo:
                                </p>
                                
                                <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%">
                                    <tr>
                                        <td align="center">
                                            <a href="${pdfUrl}" target="_blank" style="background-color: #2563eb; color: #ffffff; padding: 16px 32px; text-decoration: none; border-radius: 6px; font-weight: bold; font-size: 16px; display: inline-block; box-shadow: 0 2px 4px rgba(37, 99, 235, 0.2);">
                                                ACESSAR DOCUMENTO
                                            </a>
                                        </td>
                                    </tr>
                                </table>
                                
                                <p style="font-size: 13px; color: #64748b; margin-top: 30px; text-align: center;">
                                    Link direto: <a href="${pdfUrl}" style="color: #2563eb;">${pdfUrl}</a>
                                </p>
                            </td>
                        </tr>
                        
                        <!-- Footer -->
                        <tr>
                            <td style="background-color: #f8fafc; padding: 20px; text-align: center; border-top: 1px solid #e2e8f0;">
                                <p style="font-size: 11px; color: #94a3b8; margin: 0;">
                                    Enviado via Plataforma Notify - Automação Jurídica.<br/>
                                    Este é um aviso automático, por favor não responda a este e-mail.
                                </p>
                            </td>
                        </tr>
                    </table>
                </td>
            </tr>
        </table>
        <img src="https://notify.ia.br/api/pixel?id=${notificationId}" width="1" height="1" style="display:none" alt="" />
      </body>
      </html>
    `,
    custom_args: {
        notificationId: notificationId || "unknown"
    }
  };

  try {
    await sgMail.send(msg);
    return res.status(200).json({ success: true });
  } catch (error) {
    console.error("[API/EMAIL] Erro SendGrid:", error.response?.body || error.message);
    return res.status(500).json({ error: 'Falha ao enviar e-mail.', details: error.message });
  }
}
