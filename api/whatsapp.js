export default async function handler(req, res) {
  // CORS Configuration
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,POST');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
  );

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { phone, message, pdfUrl, fileName } = req.body;
  const instanceId = process.env.ZAPI_INSTANCE_ID;
  const token = process.env.ZAPI_INSTANCE_TOKEN;

  if (!instanceId || !token) {
    console.error("ZAPI Credentials não configuradas.");
    return res.status(500).json({ error: "Configuração de Z-API incompleta." });
  }

  // Formatar telefone para padrão internacional (55 + DDD + Numero) sem caracteres especiais
  // Remove tudo que não é dígito
  let cleanPhone = phone.replace(/\D/g, '');
  if (cleanPhone.length < 12) {
      // Assume Brasil se não tiver código de país e for tamanho típico
      cleanPhone = '55' + cleanPhone;
  }

  try {
    const ZAPI_BASE = `https://api.z-api.io/instances/${instanceId}/token/${token}`;
    
    let endpoint = '/send-text';
    let body = {
        phone: cleanPhone,
        message: message
    };

    // Se houver PDF, usamos o endpoint de documento
    if (pdfUrl) {
        endpoint = '/send-document-pdf'; // Alguns endpoints da Z-API podem ser /send-document
        body = {
            phone: cleanPhone,
            document: pdfUrl,
            fileName: fileName || "Notificacao_Extrajudicial.pdf",
            caption: message // Texto que acompanha o documento
        };
    }

    const response = await fetch(`${ZAPI_BASE}${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
    });

    const data = await response.json();

    if (!response.ok) {
        console.error("Z-API Error Response:", data);
        throw new Error(data.message || "Erro ao enviar mensagem Z-API");
    }

    return res.status(200).json({ success: true, data });

  } catch (error) {
    console.error("Z-API Handler Error:", error);
    return res.status(500).json({ error: error.message });
  }
}