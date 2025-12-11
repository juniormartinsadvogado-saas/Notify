
import * as admin from 'firebase-admin';
import sgMail from '@sendgrid/mail';

// --- CONFIGURAÇÃO DO FIREBASE ADMIN (SERVER-SIDE) ---
if (!admin.apps.length) {
  try {
    admin.initializeApp({
      credential: admin.credential.cert({
        projectId: process.env.FIREBASE_PROJECT_ID,
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
        // Corrige a formatação da chave privada para funcionar na Vercel
        privateKey: process.env.FIREBASE_PRIVATE_KEY ? process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n') : undefined,
      }),
      storageBucket: "notify-jma.firebasestorage.app"
    });
  } catch (error) {
    console.error('Erro ao inicializar Firebase Admin:', error);
  }
}

const db = admin.firestore();

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

  // VALIDAÇÃO DE SEGURANÇA (PORTEIRO ELETRÔNICO)
  const asaasToken = req.headers['asaas-access-token'];
  
  if (process.env.ASAAS_WEBHOOK_TOKEN) {
      if (asaasToken !== process.env.ASAAS_WEBHOOK_TOKEN) {
         console.warn(`[WEBHOOK] ⛔ BLOQUEIO: Token recebido (${asaasToken || 'vazio'}) difere do configurado.`);
         return res.status(401).json({ error: 'Acesso Negado: Token Inválido' });
      }
      console.log('[WEBHOOK] 🔐 Segurança: Acesso AUTORIZADO via Token.');
  } else {
      console.log('[WEBHOOK] ⚠️ AVISO: Variável ASAAS_WEBHOOK_TOKEN não configurada. Endpoint público.');
  }

  const event = req.body;

  console.log(`[WEBHOOK ASAAS] Evento: ${event.event} | ID Pagamento: ${event.payment?.id}`);

  // 2. Filtra apenas eventos de Pagamento Confirmado
  if (event.event !== 'PAYMENT_CONFIRMED' && event.event !== 'PAYMENT_RECEIVED') {
    return res.status(200).json({ received: true, message: 'Evento ignorado (não é confirmação)' });
  }

  const payment = event.payment;
  
  // LÓGICA ROBUSTA PARA ENCONTRAR O ID DA NOTIFICAÇÃO
  let notificationId = payment.externalReference; 
  
  // Fallback: Se não vier no externalReference, tenta achar na descrição (ex: "Notificação - Ref: NOT-123")
  if (!notificationId && payment.description && payment.description.includes('Ref: ')) {
      try {
          const parts = payment.description.split('Ref: ');
          if (parts.length > 1) {
              notificationId = parts[1].trim();
              console.log(`[WEBHOOK] ID recuperado da descrição: ${notificationId}`);
          }
      } catch (e) {
          console.error("Erro ao fazer parse da descrição", e);
      }
  }

  if (!notificationId) {
    console.error('[WEBHOOK] Pagamento sem Notification ID (externalReference ou Descrição).');
    return res.status(200).json({ received: true, error: 'Sem ID de referência' });
  }

  try {
    // 3. Busca os dados da Notificação no Banco de Dados
    const docRef = db.collection('notificacoes').doc(notificationId);
    const docSnap = await docRef.get();

    if (!docSnap.exists) {
      console.error('[WEBHOOK] Notificação não encontrada no banco:', notificationId);
      return res.status(404).json({ error: 'Notificação não encontrada' });
    }

    const notification = docSnap.data();

    // Se já foi enviada, não faz nada para evitar duplicidade
    if (notification.status === 'Enviada' || notification.status === 'SENT') {
       console.log('[WEBHOOK] Notificação já processada anteriormente.');
       return res.status(200).json({ received: true, message: 'Já processado anteriormente' });
    }

    // 4. ATUALIZA O STATUS NO BANCO (Imediato)
    await docRef.update({
        status: 'Enviada', // ou 'SENT' conforme seu enum
        updatedAt: new Date().toISOString(),
        paymentId: payment.id,
        paymentDate: payment.paymentDate || new Date().toISOString()
    });

    console.log(`[WEBHOOK] Status atualizado para SENT: ${notificationId}`);

    // 5. DISPAROS AUTOMÁTICOS (SendGrid & Z-API)
    
    // --- ENVIO DE E-MAIL (SendGrid) ---
    // Fazemos uma chamada interna para a API de e-mail para manter a lógica separada e limpa
    if (notification.recipientEmail) {
        try {
            // Chamada direta para a função de e-mail local (se estiver no mesmo ambiente) 
            // ou invocação direta da lib SendGrid aqui para garantir execução no mesmo contexto serverless
            const apiKey = process.env.SENDGRID_EMAIL_API_KEY || process.env.ENDGRID_EMAIL_API_KEY;
            
            if (apiKey) {
                sgMail.setApiKey(apiKey);
                const senderEmail = process.env.SENDGRID_FROM_EMAIL || 'notificacao@notify.ia.br';
                
                const msg = {
                    to: notification.recipientEmail,
                    from: senderEmail,
                    subject: `NOTIFICAÇÃO EXTRAJUDICIAL: ${notification.subject}`,
                    html: `
                      <div style="font-family: 'Helvetica Neue', Arial, sans-serif; background-color: #f4f4f7; padding: 40px 0;">
                        <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.05);">
                            <!-- Header -->
                            <div style="background-color: #0F172A; padding: 30px; text-align: center;">
                                <h1 style="color: #ffffff; margin: 0; font-size: 24px; font-weight: 700; letter-spacing: 1px;">NOTIFICAÇÃO EXTRAJUDICIAL</h1>
                                <p style="color: #94a3b8; margin: 10px 0 0 0; font-size: 14px;">Documento com validade jurídica e registro digital</p>
                            </div>

                            <!-- Body -->
                            <div style="padding: 40px 30px;">
                                <p style="font-size: 16px; color: #334155; margin-bottom: 24px;">Prezado(a) <strong>${notification.recipientName}</strong>,</p>
                                
                                <p style="font-size: 15px; color: #475569; line-height: 1.6; margin-bottom: 24px;">
                                    Você está recebendo este comunicado oficial referente ao assunto: <strong>${notification.subject}</strong>.
                                    Esta notificação foi registrada em sistema e possui rastreamento de entrega.
                                </p>

                                <div style="background-color: #f8fafc; border-left: 4px solid #3b82f6; padding: 15px; margin-bottom: 30px;">
                                    <p style="margin: 0; font-size: 14px; color: #64748b;">
                                        <strong>Remetente:</strong> ${notification.notificante_dados_expostos.nome}<br/>
                                        <strong>Data de Emissão:</strong> ${new Date().toLocaleDateString('pt-BR')}
                                    </p>
                                </div>

                                <div style="text-align: center; margin: 40px 0;">
                                    <a href="${notification.pdf_url}" style="background-color: #0F172A; color: #ffffff; padding: 16px 32px; text-decoration: none; border-radius: 6px; font-weight: bold; font-size: 16px; display: inline-block; box-shadow: 0 4px 6px rgba(15, 23, 42, 0.2);">
                                        Visualizar Documento (PDF)
                                    </a>
                                </div>

                                <p style="font-size: 13px; color: #94a3b8; text-align: center; margin-top: 30px;">
                                    O acesso a este documento é monitorado. A não visualização não isenta das responsabilidades legais descritas no teor da notificação.
                                </p>
                            </div>

                            <!-- Footer -->
                            <div style="background-color: #f1f5f9; padding: 20px; text-align: center; border-top: 1px solid #e2e8f0;">
                                <p style="font-size: 12px; color: #64748b; margin: 0;">
                                    Enviado via Plataforma Notify - Automação Jurídica.<br/>
                                    Não responda a este e-mail automaticamente.
                                </p>
                            </div>
                        </div>
                      </div>
                    `
                };
                
                await sgMail.send(msg);
                console.log('[WEBHOOK] E-mail enviado com sucesso.');
            } else {
                console.warn('[WEBHOOK] API Key SendGrid não configurada.');
            }
        } catch (emailErr) {
            console.error('[WEBHOOK] Erro ao enviar e-mail:', emailErr);
        }
    }

    // --- ENVIO DE WHATSAPP (Z-API) ---
    if (notification.recipientPhone) {
        const instanceId = process.env.API_INSTANCE_ID || process.env.ZAPI_INSTANCE_ID;
        const token = process.env.API_INSTANCE_TOKEN || process.env.ZAPI_INSTANCE_TOKEN;

        if (instanceId && token) {
            // Formata telefone (remove não dígitos e garante 55)
            let cleanPhone = notification.recipientPhone.replace(/\D/g, '');
            if (cleanPhone.length < 13) cleanPhone = '55' + cleanPhone;

            const message = `Olá, ${notification.recipientName}.\n\nUma *Notificação Extrajudicial* foi emitida e registrada em nosso sistema.\n\n*Assunto:* ${notification.subject}\n\n⚠️ Este documento possui validade jurídica. Recomendamos a leitura imediata através do link oficial abaixo:\n\n📄 *Acessar Documento:* ${notification.pdf_url}\n\nAtenciosamente,\n*${notification.notificante_dados_expostos.nome}*`;

            const zapiBase = `https://api.z-api.io/instances/${instanceId}/token/${token}`;
            
            try {
                // Tenta enviar como PDF primeiro para formalidade
                if (notification.pdf_url) {
                    await fetch(`${zapiBase}/send-document-pdf`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            phone: cleanPhone,
                            document: notification.pdf_url,
                            fileName: "Notificacao_Extrajudicial.pdf",
                            caption: message
                        })
                    });
                } else {
                    await fetch(`${zapiBase}/send-text`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            phone: cleanPhone,
                            message: message
                        })
                    });
                }
                console.log('[WEBHOOK] WhatsApp enviado com sucesso.');
            } catch (zapErr) {
                console.error('[WEBHOOK] Erro ao enviar WhatsApp:', zapErr);
            }
        } else {
            console.warn('[WEBHOOK] Credenciais Z-API não configuradas, pulando envio de WhatsApp.');
        }
    }

    return res.status(200).json({ success: true });

  } catch (error) {
    console.error('[WEBHOOK] Erro crítico:', error);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
}
