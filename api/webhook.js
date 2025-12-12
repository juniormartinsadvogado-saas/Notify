
import * as admin from 'firebase-admin';
import sgMail from '@sendgrid/mail';

// Função auxiliar para inicializar o DB de forma segura
function getFirebaseDB() {
    // CORREÇÃO CRÍTICA: Suporte a ESM/CJS na Vercel para evitar "undefined reading length"
    // Alguns ambientes carregam o firebase-admin dentro de .default
    const firebasePkg = admin.default || admin;

    // Usa ?. (optional chaining) para não quebrar se .apps for undefined
    if (!firebasePkg.apps?.length) {
        try {
            const privateKey = process.env.FIREBASE_PRIVATE_KEY 
                ? process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n') // Corrige quebras de linha escapadas
                : undefined;

            const serviceAccount = {
                projectId: process.env.FIREBASE_PROJECT_ID,
                clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
                privateKey: privateKey,
            };

            if (!serviceAccount.projectId || !serviceAccount.clientEmail || !serviceAccount.privateKey) {
                console.error("[WEBHOOK INIT] Faltam variáveis de ambiente do Firebase.");
                return null;
            }

            firebasePkg.initializeApp({
                credential: firebasePkg.credential.cert(serviceAccount),
                storageBucket: "notify-jma.firebasestorage.app"
            });
            console.log("[WEBHOOK INIT] Firebase Admin inicializado com sucesso.");
        } catch (error) {
            // Se der erro de "já existe app padrão", apenas ignoramos e seguimos
            if (error.code !== 'app/duplicate-app') {
                console.error('[WEBHOOK INIT] Erro fatal ao inicializar Firebase Admin:', error);
                return null;
            }
        }
    }
    return firebasePkg.firestore();
}

export default async function handler(req, res) {
  // CORS Configuration
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,POST');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, asaas-access-token'
  );

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
      // 1. Validação de Token (Opcional, mas recomendado)
      const asaasToken = req.headers['asaas-access-token'];
      if (process.env.ASAAS_WEBHOOK_TOKEN && asaasToken !== process.env.ASAAS_WEBHOOK_TOKEN) {
          console.warn(`[WEBHOOK] Token inválido ou não fornecido.`);
          // Não retornamos 401 para não expor a existência do endpoint para scanners, apenas logamos e rejeitamos
          return res.status(200).json({ error: 'Acesso Negado (Token)' });
      }

      const event = req.body;
      console.log(`[WEBHOOK] Recebido evento: ${event.event} | ID Pagamento: ${event.payment?.id}`);

      // 2. Filtro de Eventos
      if (event.event !== 'PAYMENT_CONFIRMED' && event.event !== 'PAYMENT_RECEIVED') {
        return res.status(200).json({ received: true, message: 'Ignorado (status irrelevante)' });
      }

      // 3. Inicializa DB
      const db = getFirebaseDB();
      if (!db) {
          return res.status(500).json({ error: 'Falha na configuração do Banco de Dados (Server)' });
      }

      const payment = event.payment;
      let notificationId = payment.externalReference; 
      
      // Fallback: Tenta extrair da descrição se externalReference falhar
      if (!notificationId && payment.description && payment.description.includes('Ref: ')) {
          try {
              const parts = payment.description.split('Ref: ');
              if (parts.length > 1) {
                  // Pega o ID que geralmente começa com NOT-
                  const possibleId = parts[1].trim().split(' ')[0]; 
                  notificationId = possibleId;
              }
          } catch (e) {
              console.warn('[WEBHOOK] Falha ao extrair ID da descrição:', e);
          }
      }

      if (!notificationId) {
        console.error('[WEBHOOK] Pagamento sem Notification ID (externalReference) e falha no fallback.');
        return res.status(200).json({ error: 'Sem ID de referência' });
      }

      // 4. Busca e Validação de Idempotência
      const docRef = db.collection('notificacoes').doc(notificationId);
      const docSnap = await docRef.get();

      if (!docSnap.exists) {
        console.error(`[WEBHOOK] Notificação não encontrada no Firestore: ${notificationId}`);
        // Retornamos 200 para o Asaas parar de tentar enviar, pois o ID não existe no nosso banco
        return res.status(200).json({ error: 'Notificação não encontrada no sistema' });
      }

      const notification = docSnap.data();
      const alreadySent = notification.status === 'Enviada' || notification.status === 'SENT';

      // LÓGICA BLINDADA: Só processa atualização e envio se ainda NÃO foi enviado
      if (!alreadySent) {
          await docRef.update({
              status: 'Enviada', 
              updatedAt: new Date().toISOString(),
              paymentId: payment.id,
              paymentDate: payment.paymentDate || new Date().toISOString(),
              paymentMethod: payment.billingType || 'ASAAS_WEBHOOK'
          });
          console.log(`[WEBHOOK] Notificação ${notificationId} atualizada para ENVIADA com sucesso.`);

          // 5. DISPAROS (Apenas se não foi enviado antes)
          const dispatchPromises = [];

          // Email via SendGrid
          if (notification.recipientEmail && (process.env.SENDGRID_EMAIL_API_KEY || process.env.ENDGRID_EMAIL_API_KEY)) {
              const emailTask = async () => {
                  try {
                      sgMail.setApiKey(process.env.SENDGRID_EMAIL_API_KEY || process.env.ENDGRID_EMAIL_API_KEY);
                      await sgMail.send({
                          to: notification.recipientEmail,
                          from: process.env.SENDGRID_FROM_EMAIL || 'notificacao@notify.ia.br',
                          subject: `NOTIFICAÇÃO EXTRAJUDICIAL: ${notification.subject}`,
                          html: `<p>Olá ${notification.recipientName},<br/><br/>Você possui uma notificação extrajudicial importante registrada em nosso sistema.<br/>Para acessar o documento assinado digitalmente, clique no link abaixo:<br/><br/><a href="${notification.pdf_url}"><strong>Visualizar Documento (PDF)</strong></a><br/><br/>Atenciosamente,<br/>Plataforma Notify</p>`
                      });
                      console.log('[WEBHOOK] Email enviado com sucesso.');
                  } catch (e) {
                      console.error('[WEBHOOK] Erro Email:', e.message);
                  }
              };
              dispatchPromises.push(emailTask());
          }

          // WhatsApp via Z-API
          if (notification.recipientPhone && (process.env.API_INSTANCE_ID || process.env.ZAPI_INSTANCE_ID)) {
              const whatsTask = async () => {
                  try {
                      const instanceId = process.env.API_INSTANCE_ID || process.env.ZAPI_INSTANCE_ID;
                      const token = process.env.API_INSTANCE_TOKEN || process.env.ZAPI_INSTANCE_TOKEN;
                      let cleanPhone = notification.recipientPhone.replace(/\D/g, '');
                      if (cleanPhone.length < 13 && !cleanPhone.startsWith('55')) cleanPhone = '55' + cleanPhone;
                      
                      const zapiResponse = await fetch(`https://api.z-api.io/instances/${instanceId}/token/${token}/send-document-pdf`, {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({
                              phone: cleanPhone,
                              document: notification.pdf_url,
                              fileName: "Notificacao_Extrajudicial.pdf",
                              caption: `Olá, ${notification.recipientName}.\n\nVocê recebeu uma notificação extrajudicial importante.\nAcesse o documento oficial acima.`
                          })
                      });
                      
                      const zapiData = await zapiResponse.json();
                      if (!zapiResponse.ok) {
                          throw new Error(JSON.stringify(zapiData));
                      }
                      console.log('[WEBHOOK] WhatsApp enviado com sucesso.');
                  } catch (e) {
                      console.error('[WEBHOOK] Erro Whats:', e.message);
                  }
              };
              dispatchPromises.push(whatsTask());
          }

          // Aguarda Promises para garantir execução na Vercel
          if (dispatchPromises.length > 0) {
              await Promise.all(dispatchPromises);
          }
      } else {
          console.log(`[WEBHOOK] Notificação ${notificationId} já processada. Ignorando disparos duplicados.`);
      }

      return res.status(200).json({ success: true });

  } catch (error) {
      console.error('[WEBHOOK] Erro geral:', error);
      // Retorna 200 com detalhes do erro para o Asaas ver que recebemos a requisição,
      // mesmo que tenha dado erro lógico, para evitar loops infinitos de retentativa se o erro for no nosso código.
      return res.status(200).json({ error: 'Erro interno processado', details: error.message });
  }
}
