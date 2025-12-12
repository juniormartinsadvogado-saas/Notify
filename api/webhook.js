
import * as admin from 'firebase-admin';
import sgMail from '@sendgrid/mail';

// --- CONFIGURAÇÃO DO FIREBASE ADMIN (SERVER-SIDE) ---
if (!admin.apps.length) {
  try {
    const serviceAccount = {
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      // Tratamento robusto para quebras de linha na chave privada
      privateKey: process.env.FIREBASE_PRIVATE_KEY 
        ? process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n') 
        : undefined,
    };

    if (serviceAccount.privateKey) {
        admin.initializeApp({
          credential: admin.credential.cert(serviceAccount),
          storageBucket: "notify-jma.firebasestorage.app"
        });
    } else {
        console.warn("[WEBHOOK] Aviso: Chave privada do Firebase não configurada.");
    }
  } catch (error) {
    console.error('[WEBHOOK] Erro fatal ao inicializar Firebase Admin:', error);
  }
}

const db = admin.apps.length ? admin.firestore() : null;

export default async function handler(req, res) {
  // 1. Configurações de Segurança e CORS
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,POST');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, asaas-access-token'
  );

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Bloco Principal de Try/Catch para evitar 500 no Asaas a todo custo
  try {
      // VALIDAÇÃO DE SEGURANÇA (PORTEIRO ELETRÔNICO)
      const asaasToken = req.headers['asaas-access-token'];
      
      if (process.env.ASAAS_WEBHOOK_TOKEN) {
          if (asaasToken !== process.env.ASAAS_WEBHOOK_TOKEN) {
             console.warn(`[WEBHOOK] ⛔ BLOQUEIO: Token recebido inválido.`);
             return res.status(401).json({ error: 'Acesso Negado' });
          }
      }

      const event = req.body;
      console.log(`[WEBHOOK ASAAS] Evento: ${event.event} | ID: ${event.payment?.id}`);

      // 2. Filtra apenas eventos de Pagamento Confirmado
      if (event.event !== 'PAYMENT_CONFIRMED' && event.event !== 'PAYMENT_RECEIVED') {
        return res.status(200).json({ received: true, message: 'Ignorado (status irrelevante)' });
      }

      if (!db) {
          console.error("[WEBHOOK] Erro: Banco de dados não inicializado.");
          // Retornamos 200 mesmo com erro interno para não travar o Asaas em loop
          return res.status(200).json({ error: 'Erro interno de configuração DB, mas recebido.' });
      }

      const payment = event.payment;
      let notificationId = payment.externalReference; 
      
      // Fallback: Busca ID na descrição se não vier na referência externa
      if (!notificationId && payment.description && payment.description.includes('Ref: ')) {
          try {
              const parts = payment.description.split('Ref: ');
              if (parts.length > 1) {
                  notificationId = parts[1].trim();
              }
          } catch (e) {}
      }

      if (!notificationId) {
        console.error('[WEBHOOK] Pagamento sem Notification ID.');
        return res.status(200).json({ received: true, error: 'Sem ID de referência' });
      }

      // 3. Busca e Atualiza no Firestore (CRITICAL PATH)
      const docRef = db.collection('notificacoes').doc(notificationId);
      const docSnap = await docRef.get();

      if (!docSnap.exists) {
        console.error('[WEBHOOK] Notificação não encontrada no banco:', notificationId);
        return res.status(200).json({ error: 'Notificação não existe no banco' });
      }

      const notification = docSnap.data();

      // Evita duplicidade de processamento
      if (notification.status === 'Enviada' || notification.status === 'SENT') {
         return res.status(200).json({ received: true, message: 'Já processado' });
      }

      // ATUALIZAÇÃO CRÍTICA DO STATUS
      await docRef.update({
          status: 'Enviada', 
          updatedAt: new Date().toISOString(),
          paymentId: payment.id,
          paymentDate: payment.paymentDate || new Date().toISOString()
      });

      console.log(`[WEBHOOK] ✅ Sucesso! Notificação ${notificationId} marcada como Paga/Enviada.`);

      // 4. DISPAROS (Em try/catch isolados para NÃO QUEBRAR o webhook se falharem)
      
      // E-mail SendGrid
      if (notification.recipientEmail) {
          try {
              const apiKey = process.env.SENDGRID_EMAIL_API_KEY || process.env.ENDGRID_EMAIL_API_KEY;
              if (apiKey) {
                  sgMail.setApiKey(apiKey);
                  const senderEmail = process.env.SENDGRID_FROM_EMAIL || 'notificacao@notify.ia.br';
                  const msg = {
                      to: notification.recipientEmail,
                      from: senderEmail,
                      subject: `NOTIFICAÇÃO EXTRAJUDICIAL: ${notification.subject}`,
                      html: `<p>Olá ${notification.recipientName}, acesse sua notificação: <a href="${notification.pdf_url}">Visualizar PDF</a></p>`
                  };
                  await sgMail.send(msg);
                  console.log('[WEBHOOK] E-mail disparado.');
              }
          } catch (emailErr) {
              console.error('[WEBHOOK] Falha não-crítica no envio de e-mail:', emailErr.message);
          }
      }

      // WhatsApp Z-API
      if (notification.recipientPhone) {
          try {
              const instanceId = process.env.API_INSTANCE_ID || process.env.ZAPI_INSTANCE_ID;
              const token = process.env.API_INSTANCE_TOKEN || process.env.ZAPI_INSTANCE_TOKEN;

              if (instanceId && token) {
                  let cleanPhone = notification.recipientPhone.replace(/\D/g, '');
                  if (cleanPhone.length < 13) cleanPhone = '55' + cleanPhone;
                  const zapiBase = `https://api.z-api.io/instances/${instanceId}/token/${token}`;
                  
                  // Tenta enviar PDF
                  await fetch(`${zapiBase}/send-document-pdf`, {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({
                          phone: cleanPhone,
                          document: notification.pdf_url,
                          fileName: "Notificacao_Extrajudicial.pdf",
                          caption: `Olá, ${notification.recipientName}. Segue notificação extrajudicial referente a ${notification.subject}.`
                      })
                  });
                  console.log('[WEBHOOK] WhatsApp disparado.');
              }
          } catch (zapErr) {
              console.error('[WEBHOOK] Falha não-crítica no envio de WhatsApp:', zapErr.message);
          }
      }

      // Retorna sucesso para o Asaas parar de tentar
      return res.status(200).json({ success: true });

  } catch (fatalError) {
      console.error('[WEBHOOK] ❌ ERRO FATAL:', fatalError);
      // Aqui retornamos 500 apenas se o erro for gravíssimo e não tratado acima
      return res.status(500).json({ error: 'Internal Server Error' });
  }
}
