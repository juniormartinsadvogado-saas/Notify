
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,POST');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { phone, message, pdfUrl, fileName } = req.body;
  
  const instanceId = process.env.API_INSTANCE_ID || process.env.ZAPI_INSTANCE_ID;
  const token = process.env.API_INSTANCE_TOKEN || process.env.ZAPI_INSTANCE_TOKEN;

  if (!instanceId || !token) {
    return res.status(500).json({ error: "Configuração de API WhatsApp incompleta." });
  }

  if (!phone) return res.status(400).json({ error: "Telefone é obrigatório." });

  // --- SANITIZAÇÃO RIGOROSA ---
  // Remove tudo que não for dígito e caracteres de controle invisíveis
  let cleanPhone = String(phone).replace(/[^\d]/g, '');
  
  // Tratamento Brasil (DDI 55)
  // Se tem 10 ou 11 dígitos (DDD + Número), adiciona 55
  if (cleanPhone.length >= 10 && cleanPhone.length <= 11) {
      cleanPhone = '55' + cleanPhone;
  }
  // Se começa com 0 (ex: 04199...), remove o 0
  else if (cleanPhone.startsWith('0')) {
      cleanPhone = cleanPhone.substring(1);
      if (cleanPhone.length <= 11) cleanPhone = '55' + cleanPhone;
  }

  console.log(`[Z-API] Enviando para: ${cleanPhone}`);

  const ZAPI_BASE = `https://api.z-api.io/instances/${instanceId}/token/${token}`;

  try {
    let zaapId = null;
    let sentMethod = '';

    // 1. TENTATIVA PDF (Se URL válida)
    if (pdfUrl && pdfUrl.startsWith('http')) {
        try {
            const docResponse = await fetch(`${ZAPI_BASE}/send-document-pdf`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    phone: cleanPhone,
                    document: pdfUrl, 
                    fileName: fileName || "Notificacao_Extrajudicial.pdf",
                    caption: message 
                })
            });

            const docData = await docResponse.json();
            if (docResponse.ok && (docData.messageId || docData.id)) {
                zaapId = docData.messageId || docData.id;
                sentMethod = 'PDF';
            }
        } catch (pdfErr) {
            console.error("[Z-API] Falha PDF:", pdfErr);
        }
    }

    // 2. FALLBACK TEXTO (Se PDF falhou ou não existe)
    if (!zaapId) {
        // Garante link no texto
        let finalMessage = message;
        if (pdfUrl && !message.includes(pdfUrl)) {
            finalMessage = `${message}\n\n📄 *ACESSE O DOCUMENTO:*\n${pdfUrl}`;
        }

        const textResponse = await fetch(`${ZAPI_BASE}/send-text`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                phone: cleanPhone,
                message: finalMessage
            })
        });
        
        const textData = await textResponse.json();
        if (textResponse.ok) {
            zaapId = textData.messageId || textData.id;
            sentMethod = 'TEXT_LINK';
        }
    }

    return res.status(200).json({ success: !!zaapId, messageId: zaapId, method: sentMethod });

  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
}
