import { GoogleGenAI } from "@google/genai";
import { Attachment } from "../types";

// --- ROBUST API KEY LOADER ---
const getApiKey = () => {
  let key = '';

  // 1. Tenta via import.meta.env (Padrão Vite / Navegador)
  try {
    // @ts-ignore
    if (import.meta && import.meta.env) {
       // @ts-ignore Prioridade 1: Nome com prefixo VITE_ (Obrigatório para Vercel Frontend)
       if (import.meta.env.VITE_GOOGLE_GENERATIVE_AI_API_KEY) return import.meta.env.VITE_GOOGLE_GENERATIVE_AI_API_KEY;
       
       // @ts-ignore Prioridade 2: Nome exato (Caso o bundler exponha ou esteja rodando localmente sem prefixo)
       if (import.meta.env.GOOGLE_GENERATIVE_AI_API_KEY) return import.meta.env.GOOGLE_GENERATIVE_AI_API_KEY;
       
       // @ts-ignore Legado
       if (import.meta.env.VITE_GOOGLE_AI_API_KEY) return import.meta.env.VITE_GOOGLE_AI_API_KEY;
    }
  } catch (e) {}

  // 2. Tenta via process.env (Fallback para Node/Polyfills/Webpack ou Serverless Functions)
  if (typeof process !== 'undefined' && process.env) {
      // Prioridade 1: Nome exato definido no servidor
      if (process.env.GOOGLE_GENERATIVE_AI_API_KEY) return process.env.GOOGLE_GENERATIVE_AI_API_KEY;
      
      // Prioridade 2: Nome com prefixo VITE_ injetado no process
      if (process.env.VITE_GOOGLE_GENERATIVE_AI_API_KEY) return process.env.VITE_GOOGLE_GENERATIVE_AI_API_KEY;
      
      // Legado
      if (process.env.GOOGLE_AI_API_KEY) return process.env.GOOGLE_AI_API_KEY;
  }

  return key;
};

const fileToGenerativePart = async (file: File): Promise<{ inlineData: { data: string; mimeType: string } } | null> => {
    // Permite imagens e PDFs
    if (!file.type.startsWith('image/') && file.type !== 'application/pdf') {
        console.warn(`Tipo de arquivo não suportado para IA: ${file.type}`);
        return null;
    }

    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => {
            const base64String = reader.result as string;
            // Separa o cabeçalho "data:image/png;base64," do conteúdo
            const base64Data = base64String.split(',')[1];
            resolve({
                inlineData: {
                    data: base64Data,
                    mimeType: file.type
                }
            });
        };
        reader.onerror = reject;
        reader.readAsDataURL(file);
    });
};

export const generateNotificationText = async (
  recipient: string,
  subject: string,
  details: string,
  tone: string = 'formal',
  attachments: Attachment[] = [],
  contextInfo?: { area: string; species: string; areaDescription: string }
): Promise<string> => {
  try {
    const apiKey = getApiKey();
    
    // Se a chave não existir, o SDK irá falhar internamente ou podemos lançar erro genérico aqui
    // para ser capturado pelo catch abaixo e transformado na mensagem solicitada.
    if (!apiKey) {
        // Log para desenvolvedor apenas no console
        console.warn("API Key não detectada. Tentando execução para cair no fallback.");
    }

    const ai = new GoogleGenAI({ apiKey: apiKey || 'dummy-key-to-trigger-sdk-flow' });

    const parts: any[] = [];
    
    // Construção rigorosa do Prompt Baseado no Percurso do Usuário
    const contextPrompt = contextInfo ? `
      CONTEXTO ESTRUTURAL OBRIGATÓRIO (SEGUIR RIGOROSAMENTE):
      O usuário navegou e selecionou especificamente as seguintes categorias na plataforma:
      1. ÁREA DO DIREITO: ${contextInfo.area}
         - Definição da Área: ${contextInfo.areaDescription}
      2. ESPÉCIE DOCUMENTAL: ${contextInfo.species}
      
      INSTRUÇÃO DE ALINHAMENTO:
      O texto gerado DEVE pertencer estritamente à área de "${contextInfo.area}". 
      Use terminologia, leis e estrutura jurídica específicas para "${contextInfo.species}".
      Não desvie para outras áreas do direito.
    ` : '';

    const promptText = `
      ATUAR COMO: Advogado Sênior Especialista em Direito Brasileiro.
      TAREFA: Redigir uma Notificação Extrajudicial completa e técnica.
      
      ${contextPrompt}

      DADOS DE INPUT DO USUÁRIO:
      - Destinatário (Nome Curto): ${recipient}
      - Assunto Geral: ${subject}
      - Tom de Voz: ${tone}
      
      ---
      INFORMAÇÕES E FATOS:
      ${details}
      ---
      
      ${attachments.length > 0 ? `NOTA ADICIONAL: O usuário anexou ${attachments.length} arquivos probatórios. Analise o conteúdo visual/textual destes anexos se possível para enriquecer a descrição dos fatos.` : ''}

      ESTRUTURA DO DOCUMENTO (Markdown):
      1. CABEÇALHO (Local e Data atual)
      2. PREÂMBULO (Identificação COMPLETA das partes usando os dados fornecidos em [DADOS OBRIGATÓRIOS PARA O PREÂMBULO]. Inclua endereço, CPF/CNPJ e contatos EXATAMENTE como fornecidos. Não invente dados se eles já existem.)
      3. DOS FATOS (Narrativa detalhada baseada nos dados e no contexto de ${contextInfo?.species || 'Notificação'})
      4. DO DIREITO (Fundamentação jurídica robusta citando Artigos de Leis, Códigos ou Súmulas aplicáveis à área de ${contextInfo?.area || 'Direito'})
      5. DOS PEDIDOS (Exigências claras com prazo explícito para cumprimento)
      6. DAS CONSEQUÊNCIAS (Medidas judiciais cabíveis em caso de inércia, específicas para ${contextInfo?.area || 'este caso'})
      7. FECHAMENTO (Assinatura e contatos)
    `;
    
    parts.push({ text: promptText });

    for (const att of attachments) {
        try {
            const filePart = await fileToGenerativePart(att.file);
            if (filePart) {
                parts.push(filePart);
            }
        } catch (fileError) {
            console.error("Erro ao processar anexo:", fileError);
        }
    }

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: { parts },
      config: {
        systemInstruction: "Você é a 'Notify AI', assistente jurídica de elite. Você deve respeitar estritamente a ÁREA e a ESPÉCIE selecionadas pelo usuário ao criar o documento. O Preâmbulo deve conter a qualificação completa das partes conforme fornecido nos dados de input.",
        temperature: 0.4, 
      }
    });

    if (!response.text) {
        throw new Error("Resposta vazia da IA.");
    }

    return response.text;

  } catch (error: any) {
    // Tratamento de Erro "Silencioso" para o Usuário
    console.error("System Error (AI Generation):", error);
    
    // Mensagem Genérica Solicitada
    throw new Error("Instabilidade temporária no sistema de inteligência artificial. Por favor, tente novamente em alguns instantes.");
  }
};