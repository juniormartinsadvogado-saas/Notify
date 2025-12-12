
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

  // Limpeza agressiva do telefone
  let cleanPhone = phone.replace(/\D/g, '');
  if (cleanPhone.length < 12) {
      cleanPhone = '55' + cleanPhone;
  }

  const ZAPI_BASE = `https://api.z-api.io/instances/${instanceId}/token/${token}`;

  try {
    let sent = false;

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
                sent = true;
                console.log("[Z-API] PDF enviado com sucesso.");
            } else {
                console.warn("[Z-API] Erro ao enviar PDF, falha na API:", docData);
            }
        } catch (pdfErr) {
            console.error("[Z-API] Exceção no envio de PDF:", pdfErr.message);
        }
    }

    // FALLBACK: SE O PDF FALHOU (OU NÃO EXISTE), ENVIA TEXTO COM O LINK
    if (!sent) {
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
        
        if (!textResponse.ok) {
            throw new Error("Falha total no envio Z-API (PDF e Texto).");
        }
    }

    return res.status(200).json({ success: true });

  } catch (error) {
    console.error("[API/WHATSAPP] Handler Error:", error);
    return res.status(500).json({ error: error.message });
  }
}
