
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,POST');
  res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { phone, message, pdfUrl, fileName } = req.body;
  
  const instanceId = process.env.API_INSTANCE_ID || process.env.ZAPI_INSTANCE_ID;
  const token = process.env.API_INSTANCE_TOKEN || process.env.ZAPI_INSTANCE_TOKEN;

  if (!instanceId || !token) {
    console.error("[API/WHATSAPP] Credenciais não configuradas.");
    return res.status(500).json({ error: "Configuração de API WhatsApp incompleta." });
  }

  // Validação e Formatação rigorosa do telefone
  if (!phone) return res.status(400).json({ error: "Telefone é obrigatório." });

  let cleanPhone = phone.replace(/\D/g, '');
  // Se tiver 10 ou 11 dígitos (DDD + Numero), adiciona 55.
  // Se tiver 12 ou 13, assume que já tem DDI.
  if (cleanPhone.length < 12) {
      cleanPhone = '55' + cleanPhone;
  }

  try {
    const ZAPI_BASE = `https://api.z-api.io/instances/${instanceId}/token/${token}`;
    
    // Tenta enviar PDF se disponível
    if (pdfUrl) {
        const docResponse = await fetch(`${ZAPI_BASE}/send-document-pdf`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                phone: cleanPhone,
                document: pdfUrl,
                fileName: fileName || "Notificacao.pdf",
                caption: message
            })
        });

        const docData = await docResponse.json();
        
        // Se sucesso, retorna. Se falha, não retorna erro, deixa cair no fallback de texto.
        if (docResponse.ok) {
             return res.status(200).json({ success: true, data: docData });
        } else {
             console.warn("[API/WHATSAPP] Erro no envio de PDF, tentando texto.", docData);
        }
    }

    // Fallback: Envio de Texto Simples
    const textResponse = await fetch(`${ZAPI_BASE}/send-text`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            phone: cleanPhone,
            message: pdfUrl ? `${message}\n\nLink do Documento: ${pdfUrl}` : message
        })
    });

    const textData = await textResponse.json();

    if (!textResponse.ok) {
        throw new Error(textData.message || "Erro ao enviar mensagem");
    }

    return res.status(200).json({ success: true, data: textData });

  } catch (error) {
    console.error("[API/WHATSAPP] Handler Error:", error);
    return res.status(500).json({ error: error.message });
  }
}
