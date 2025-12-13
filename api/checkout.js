
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

  const { userEmail, metadata, payerInfo, billingType, cardData } = req.body;
  const apiKey = process.env.ASAAS_PAGAMENTO_API_KEY;

  if (!apiKey) {
    console.error("ASAAS_PAGAMENTO_API_KEY não configurada.");
    return res.status(500).json({ error: "Erro de configuração no servidor de pagamentos." });
  }

  // Definição de Valor Único para Notificação Avulsa
  const value = 57.92;
  const description = `Notificação Extrajudicial - Ref: ${metadata.notificationId || 'Avulsa'}`;
  const externalReference = metadata.notificationId; // Vincula estritamente à notificação

  let webhookUrl = null;
  if (process.env.BASE_URL) {
      webhookUrl = `${process.env.BASE_URL}/api/webhook`;
  } else if (process.env.VERCEL_URL) {
      webhookUrl = `https://${process.env.VERCEL_URL}/api/webhook`;
  }

  try {
    const ASAAS_URL = 'https://www.asaas.com/api/v3';
    
    // 1. GESTÃO DO CLIENTE NO ASAAS
    let customerId = null;
    const cpfCnpj = payerInfo?.cpfCnpj || metadata?.cpfCnpj;
    const name = payerInfo?.name || metadata?.name || 'Cliente Notify';
    
    if (cpfCnpj) {
        const cleanCpf = cpfCnpj.replace(/\D/g, '');
        const findCustomer = await fetch(`${ASAAS_URL}/customers?cpfCnpj=${cleanCpf}`, {
            method: 'GET',
            headers: { 'access_token': apiKey }
        });
        const customerData = await findCustomer.json();
        
        if (customerData.data && customerData.data.length > 0) {
            customerId = customerData.data[0].id;
        }
    }

    if (!customerId) {
        const createCustomer = await fetch(`${ASAAS_URL}/customers`, {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                'access_token': apiKey 
            },
            body: JSON.stringify({
                name: name,
                email: userEmail,
                cpfCnpj: cpfCnpj ? cpfCnpj.replace(/\D/g, '') : undefined,
                notificationDisabled: false 
            })
        });
        const newCustomer = await createCustomer.json();
        if (newCustomer.errors) throw new Error(newCustomer.errors[0].description);
        customerId = newCustomer.id;
    }

    // 2. CRIAÇÃO DA COBRANÇA (Cobrança única /payments)
    let paymentPayload = {
        customer: customerId,
        billingType: billingType,
        value: value,
        dueDate: new Date(Date.now() + 259200000).toISOString().split('T')[0], // +3 dias
        description: description,
        externalReference: externalReference, 
        postalService: false
    };

    if (billingType === 'CREDIT_CARD' && cardData) {
        paymentPayload.creditCard = {
            holderName: cardData.holderName,
            number: cardData.number,
            expiryMonth: cardData.expiryMonth,
            expiryYear: cardData.expiryYear,
            ccv: cardData.ccv
        };
        paymentPayload.creditCardHolderInfo = {
            name: cardData.holderName,
            email: userEmail,
            cpfCnpj: cpfCnpj ? cpfCnpj.replace(/\D/g, '') : undefined,
            postalCode: '00000000', 
            addressNumber: '0',
            phone: '00000000000' 
        };
    }

    const paymentResponse = await fetch(`${ASAAS_URL}/payments`, {
        method: 'POST',
        headers: { 
            'Content-Type': 'application/json',
            'access_token': apiKey 
        },
        body: JSON.stringify(paymentPayload)
    });

    const paymentData = await paymentResponse.json();

    if (paymentData.errors) {
        console.error("Asaas Payment Error:", paymentData.errors);
        throw new Error(paymentData.errors[0].description);
    }

    // 3. RETORNO
    if (billingType === 'PIX') {
        const qrResponse = await fetch(`${ASAAS_URL}/payments/${paymentData.id}/pixQrCode`, {
            method: 'GET',
            headers: { 'access_token': apiKey }
        });
        const qrData = await qrResponse.json();
        
        return res.status(200).json({ 
            success: true,
            id: paymentData.id,
            pixData: {
                encodedImage: qrData.encodedImage,
                payload: qrData.payload
            }
        });
    }

    return res.status(200).json({ 
        success: true,
        id: paymentData.id,
        status: paymentData.status
    });

  } catch (error) {
    console.error("Asaas API Error:", error);
    return res.status(500).json({ error: error.message || "Erro ao processar pagamento no Asaas." });
  }
}
