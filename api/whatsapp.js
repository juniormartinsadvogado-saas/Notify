
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

  if (!phone) return res.status(400).json({ error: "Telefone é obrigatório." });

  // --- FORMATAÇÃO DE TELEFONE (CRÍTICO) ---
  // Remove tudo que não é número
  let cleanPhone = phone.replace(/\D/g, '');
  
  // Tratamento para números brasileiros
  if (cleanPhone.length >= 10 && cleanPhone.length <= 11) {
      // Se não tem 55, adiciona
      cleanPhone = '55' + cleanPhone;
  }
  // Se tem 12 ou 13 digitos e começa com 0, remove o 0
  else if (cleanPhone.startsWith('0')) {
      cleanPhone = cleanPhone.substring(1);
      if (cleanPhone.length <= 11) cleanPhone = '55' + cleanPhone;
  }

  console.log(`[Z-API] Enviando para: ${cleanPhone}`);

  const ZAPI_BASE = `https://api.z-api.io/instances/${instanceId}/token/${token}`;

  try {
    let zaapId = null;
    let sentMethod = '';

    // 1. TENTATIVA PRIORITÁRIA: ENVIAR PDF
    if (pdfUrl) {
        console.log(`[Z-API] Tentando enviar PDF...`);
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
            if (docResponse.ok && !docData.error && (docData.messageId || docData.id)) {
                console.log("[Z-API] PDF enviado com sucesso.");
                zaapId = docData.messageId || docData.id;
                sentMethod = 'PDF';
            } else {
                console.warn("[Z-API] Falha no envio de PDF, tentando texto com link...", docData);
            }
        } catch (pdfErr) {
            console.error("[Z-API] Exceção no envio de PDF:", pdfErr.message);
        }
    }

    // 2. FALLBACK OBRIGATÓRIO: TEXTO COM LINK (Se PDF falhou ou não existe)
    if (!zaapId) {
        console.log(`[Z-API] Usando Fallback Texto para ${cleanPhone}`);
        
        // Garante que o link esteja visível no texto se o PDF falhou
        let finalMessage = message;
        if (pdfUrl && !message.includes(pdfUrl)) {
            finalMessage = `${message}\n\n📄 *CLIQUE PARA ACESSAR O DOCUMENTO:*\n${pdfUrl}`;
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
        
        if (!textResponse.ok || textData.error) {
            console.error("[Z-API] Falha no envio de texto:", textData);
            throw new Error("Falha total no envio Z-API (PDF e Texto falharam). Verifique o número.");
        }
        
        console.log("[Z-API] Texto enviado com sucesso.");
        zaapId = textData.messageId || textData.id;
        sentMethod = 'TEXT_LINK';
    }

    return res.status(200).json({ success: true, messageId: zaapId, method: sentMethod });

  } catch (error) {
    console.error("[API/WHATSAPP] Handler Error:", error);
    return res.status(500).json({ error: error.message });
  }
}
