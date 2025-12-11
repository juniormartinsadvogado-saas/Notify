
import sgMail from '@sendgrid/mail';

export default async function handler(req, res) {
  // Configuração de CORS para permitir que seu frontend chame esta função
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,POST');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
  );

  // Tratamento de pre-flight request (OPTIONS)
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  // Apenas aceita POST
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { recipientEmail, recipientName, subject, pdfUrl } = req.body;

  // Verifica se a chave do SendGrid está configurada nas variáveis de ambiente da Vercel
  const apiKey = process.env.SENDGRID_EMAIL_API_KEY || process.env.ENDGRID_EMAIL_API_KEY;

  if (!apiKey) {
    console.error("SENDGRID_EMAIL_API_KEY não encontrada.");
    return res.status(500).json({ error: 'Configuração de servidor incompleta.' });
  }

  sgMail.setApiKey(apiKey);
  
  // Define o remetente (deve ser um e-mail validado no SendGrid)
  const senderEmail = process.env.SENDGRID_FROM_EMAIL || 'notify@seuservico.com';

  const msg = {
    to: recipientEmail,
    from: senderEmail,
    subject: `NOTIFICAÇÃO EXTRAJUDICIAL: ${subject}`,
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Notificação Extrajudicial</title>
      </head>
      <body style="margin: 0; padding: 0; font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; background-color: #f4f4f5;">
        <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%">
          <tr>
            <td style="padding: 20px 0 30px 0;">
              <table align="center" border="0" cellpadding="0" cellspacing="0" width="600" style="border-collapse: collapse; background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 20px rgba(0,0,0,0.08);">
                
                <!-- Header -->
                <tr>
                  <td bgcolor="#0F172A" style="padding: 40px 30px; text-align: center;">
                    <h1 style="color: #ffffff; font-size: 24px; margin: 0; font-weight: 700; letter-spacing: 2px; text-transform: uppercase;">Notificação Extrajudicial</h1>
                    <p style="color: #94a3b8; font-size: 14px; margin: 10px 0 0 0;">Documento Oficial Registrado</p>
                  </td>
                </tr>

                <!-- Content -->
                <tr>
                  <td style="padding: 40px 30px;">
                    <p style="font-size: 16px; color: #334155; margin: 0 0 24px 0;">Olá, <strong>${recipientName}</strong>.</p>
                    
                    <p style="font-size: 15px; color: #475569; line-height: 1.6; margin: 0 0 24px 0;">
                      Este é um comunicado formal para notificá-lo(a) sobre o assunto: <strong style="color: #0F172A;">${subject}</strong>.
                    </p>

                    <table border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color: #f8fafc; border-left: 4px solid #3b82f6; margin-bottom: 30px;">
                      <tr>
                        <td style="padding: 15px;">
                          <p style="margin: 0; font-size: 14px; color: #64748b;">
                            Esta notificação possui validade jurídica, registro de data e hora, e monitoramento de entrega para fins de comprovação legal.
                          </p>
                        </td>
                      </tr>
                    </table>

                    <p style="font-size: 15px; color: #475569; line-height: 1.6; margin: 0 0 30px 0;">
                      Para tomar ciência do conteúdo integral e visualizar o documento assinado digitalmente, acesse o link seguro abaixo:
                    </p>

                    <table border="0" cellpadding="0" cellspacing="0" width="100%">
                      <tr>
                        <td align="center">
                          <a href="${pdfUrl}" target="_blank" style="display: inline-block; padding: 16px 36px; font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; font-size: 16px; font-weight: bold; color: #ffffff; text-decoration: none; background-color: #0F172A; border-radius: 8px; box-shadow: 0 4px 10px rgba(15, 23, 42, 0.2);">
                            Ler Documento (PDF)
                          </a>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>

                <!-- Footer -->
                <tr>
                  <td bgcolor="#f1f5f9" style="padding: 30px; text-align: center; border-top: 1px solid #e2e8f0;">
                    <p style="color: #64748b; font-size: 12px; margin: 0;">
                      Enviado automaticamente pela plataforma <strong>Notify</strong>.
                    </p>
                    <p style="color: #94a3b8; font-size: 11px; margin: 10px 0 0 0;">
                      A visualização deste e-mail foi registrada em nosso sistema de rastreamento.
                    </p>
                  </td>
                </tr>

              </table>
            </td>
          </tr>
        </table>
      </body>
      </html>
    `,
  };

  try {
    await sgMail.send(msg);
    return res.status(200).json({ success: true });
  } catch (error) {
    console.error("Erro SendGrid:", error);
    if (error.response) {
      console.error(error.response.body);
    }
    return res.status(500).json({ error: 'Falha ao enviar e-mail.' });
  }
}
