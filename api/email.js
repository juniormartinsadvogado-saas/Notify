
import sgMail from '@sendgrid/mail';

export default async function handler(req, res) {
  // Configuração de CORS para permitir que seu frontend chame esta função
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
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
  // Aceita tanto ENDGRID quanto SENDGRID para compatibilidade
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
    subject: `NOTIFY: ${subject}`,
    html: `
      <div style="font-family: Arial, sans-serif; padding: 20px; color: #333; border: 1px solid #eee; border-radius: 8px;">
        <h2 style="color: #0F172A;">Olá, ${recipientName}</h2>
        <p>Uma nova notificação extrajudicial foi gerada para você através da plataforma Notify.</p>
        <p>Para acessar o conteúdo integral e o documento assinado digitalmente, clique no botão abaixo:</p>
        <br/>
        <a href="${pdfUrl}" style="background-color: #0F172A; color: white; padding: 14px 28px; text-decoration: none; border-radius: 6px; display: inline-block; font-weight: bold;">
          Acessar Documento Oficial
        </a>
        <br/><br/>
        <p style="font-size: 12px; color: #888; margin-top: 30px;">
          Esta é uma mensagem automática. Por favor, não responda este e-mail.<br/>
          Gerado via Plataforma Notify - Inteligência Jurídica.
        </p>
      </div>
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
