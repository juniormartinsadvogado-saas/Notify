
import { GoogleGenAI } from "@google/genai";
import { Attachment } from "../types";

export const generateNotificationText = async (
  recipient: string,
  subject: string,
  details: string,
  tone: string = 'formal',
  attachments: Attachment[] = [],
  contextInfo?: { area: string; species: string; areaDescription: string }
): Promise<string> => {
  try {
    // Tenta obter a chave de várias fontes possíveis para garantir funcionamento em diferentes ambientes
    let apiKey = '';
    try {
        // @ts-ignore
        if (typeof process !== 'undefined' && process.env) apiKey = process.env.API_KEY || process.env.VITE_API_KEY || '';
        // @ts-ignore
        if (!apiKey && import.meta && import.meta.env) apiKey = import.meta.env.API_KEY || import.meta.env.VITE_API_KEY || '';
    } catch (e) {
        console.warn("Erro ao ler variáveis de ambiente:", e);
    }

    if (!apiKey) {
        throw new Error("Chave de API (API_KEY) não configurada no sistema.");
    }

    const ai = new GoogleGenAI({ apiKey });

    // Construção do Prompt Otimizado
    const contextPrompt = contextInfo ? `
      CONTEXTO ESTRUTURAL OBRIGATÓRIO:
      1. ÁREA DO DIREITO: ${contextInfo.area} (${contextInfo.areaDescription})
      2. ESPÉCIE: ${contextInfo.species}
      
      INSTRUÇÃO: O texto DEVE pertencer estritamente à área de "${contextInfo.area}". Use terminologia e leis específicas para "${contextInfo.species}".
    ` : '';

    const promptText = `
      ATUAR COMO: Advogado Sênior Especialista em Direito Brasileiro.
      TAREFA: Redigir uma Notificação Extrajudicial completa.
      
      ${contextPrompt}

      DADOS:
      - Destinatário: ${recipient}
      - Assunto: ${subject}
      - Tom: ${tone}
      
      FATOS RELATADOS:
      ${details}
      
      ESTRUTURA (TEXTO PLANO - SEM MARKDOWN, SEM NEGRITO):
      Use CAIXA ALTA para títulos.
      
      1. CABEÇALHO (Local e Data atual)
      2. PREÂMBULO (Identificação COMPLETA das partes. Use os dados fornecidos: CPF, Endereço, etc.)
      3. DOS FATOS (Narrativa detalhada)
      4. DO DIREITO (Fundamentação jurídica, Artigos de Lei, Código Civil/Penal/CDC conforme a área)
      5. DOS PEDIDOS (Exigências claras com prazo para cumprimento)
      6. DAS CONSEQUÊNCIAS (Medidas judiciais caso não atendido)
      7. FECHAMENTO (Assinatura)
    `;

    // Preparação das partes do conteúdo (Texto + Imagens)
    const parts: any[] = [{ text: promptText }];

    // Processamento de anexos para o modelo multimodal
    if (attachments && attachments.length > 0) {
        for (const att of attachments) {
            if (att.type === 'image' || att.type === 'document') { 
                 try {
                     const base64Data = await fileToBase64(att.file);
                     parts.push({
                         inlineData: {
                             mimeType: att.file.type,
                             data: base64Data
                         }
                     });
                 } catch (imgError) {
                     console.error("Erro ao processar anexo para IA:", imgError);
                 }
            }
        }
    }

    // Chamada ao Modelo
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: { parts },
      config: {
        temperature: 0.4, 
      }
    });

    if (!response.text) {
        throw new Error("A IA retornou uma resposta vazia.");
    }

    return response.text;

  } catch (error: any) {
    console.error("Erro CRÍTICO na geração IA:", error);
    throw new Error(`Falha ao gerar documento: ${error.message || 'Erro de conexão com a IA'}`);
  }
};

// Helper para converter File em Base64 string pura
const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
            const result = reader.result as string;
            // Remove o prefixo "data:image/png;base64," para enviar apenas os bytes
            const base64 = result.split(',')[1];
            resolve(base64);
        };
        reader.onerror = error => reject(error);
        reader.readAsDataURL(file);
    });
};
