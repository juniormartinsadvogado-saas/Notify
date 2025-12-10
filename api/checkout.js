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

  const { mode, userEmail, metadata, payerInfo, billingType } = req.body;
  const apiKey = process.env.ASAAS_PAGAMENTO_API_KEY;

  if (!apiKey) {
    console.error("ASAAS_PAGAMENTO_API_KEY não configurada.");
    return res.status(500).json({ error: "Erro de configuração no servidor de pagamentos." });
  }

  // Validação do Tipo de Pagamento (Força PIX ou CREDIT_CARD)
  const selectedBillingType = billingType === 'PIX' ? 'PIX' : 'CREDIT_CARD';

  // Definição de Valores
  const value = mode === 'subscription' ? 259.97 : 57.92;
  const description = mode === 'subscription' 
    ? 'Assinatura Notify Pro - Mensal' 
    : `Notificação Extrajudicial - Ref: ${metadata.notificationId || 'Avulsa'}`;

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

    // 2. CRIAÇÃO DA COBRANÇA OU ASSINATURA
    let paymentResponse;
    let paymentData;

    if (mode === 'subscription') {
        // Criar Assinatura Mensal
        paymentResponse = await fetch(`${ASAAS_URL}/subscriptions`, {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                'access_token': apiKey 
            },
            body: JSON.stringify({
                customer: customerId,
                billingType: selectedBillingType, // Restringe ao tipo escolhido (Sem Boleto)
                value: value,
                nextDueDate: new Date(Date.now() + 86400000).toISOString().split('T')[0], // Amanhã
                cycle: 'MONTHLY',
                description: description,
                externalReference: metadata.userId
            })
        });
    } else {
        // Criar Cobrança Única
        paymentResponse = await fetch(`${ASAAS_URL}/payments`, {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                'access_token': apiKey 
            },
            body: JSON.stringify({
                customer: customerId,
                billingType: selectedBillingType, // Restringe ao tipo escolhido
                value: value,
                dueDate: new Date(Date.now() + 259200000).toISOString().split('T')[0], // +3 dias
                description: description,
                externalReference: metadata.notificationId,
                postalService: false
            })
        });
    }

    paymentData = await paymentResponse.json();

    if (paymentData.errors) {
        throw new Error(paymentData.errors[0].description);
    }

    return res.status(200).json({ 
        url: paymentData.invoiceUrl,
        id: paymentData.id 
    });

  } catch (error) {
    console.error("Asaas API Error:", error);
    return res.status(500).json({ error: error.message || "Erro ao processar pagamento no Asaas." });
  }
}