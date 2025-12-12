
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

  // LIMPEZA E FORMATAÇÃO RIGOROSA DO TELEFONE
  // 1. Remove tudo que não for dígito
  let cleanPhone = phone.replace(/\D/g, '');
  
  // 2. Remove zero à esquerda se houver (ex: 011999... -> 11999...)
  if (cleanPhone.startsWith('0') && cleanPhone.length >= 11) {
      cleanPhone = cleanPhone.substring(1);
  }

  // 3. Lógica para adicionar 55 se faltar
  if (cleanPhone.length >= 10 && cleanPhone.length <= 11) {
      cleanPhone = '55' + cleanPhone;
  }
  
  console.log(`[Z-API] Enviando para: ${cleanPhone}`);

  const ZAPI_BASE = `https://api.z-api.io/instances/${instanceId}/token/${token}`;

  try {
    let zaapId = null;

    // TENTA ENVIAR PDF SE EXISTIR URL
    if (pdfUrl) {
        console.log(`[Z-API] Tentando enviar PDF para ${cleanPhone}`);
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
            if (docResponse.ok && !docData.error) {
                console.log("[Z-API] PDF enviado com sucesso.");
                zaapId = docData.messageId || docData.id;
            } else {
                console.warn("[Z-API] Erro ao enviar PDF, falha na API:", docData);
            }
        } catch (pdfErr) {
            console.error("[Z-API] Exceção no envio de PDF:", pdfErr.message);
        }
    }

    // FALLBACK: SE O PDF FALHOU (OU NÃO EXISTE), ENVIA TEXTO COM O LINK
    if (!zaapId) {
        console.log(`[Z-API] Usando Fallback Texto para ${cleanPhone}`);
        const textPayload = {
            phone: cleanPhone,
            message: pdfUrl ? `${message}\n\n📄 *ACESSE O DOCUMENTO AQUI:* ${pdfUrl}` : message
        };

        const textResponse = await fetch(`${ZAPI_BASE}/send-text`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(textPayload)
        });
        
        const textData = await textResponse.json();
        
        if (!textResponse.ok || textData.error) {
            console.error("[Z-API] Falha no envio de texto:", textData);
            throw new Error("Falha total no envio Z-API.");
        }
        console.log("[Z-API] Texto enviado com sucesso.");
        zaapId = textData.messageId || textData.id;
    }

    // Retorna o ID da mensagem para fins de rastreamento no webhook
    return res.status(200).json({ success: true, messageId: zaapId });

  } catch (error) {
    console.error("[API/WHATSAPP] Handler Error:", error);
    return res.status(500).json({ error: error.message });
  }
}
