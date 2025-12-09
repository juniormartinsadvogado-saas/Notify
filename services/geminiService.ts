import { GoogleGenAI } from "@google/genai";
import { Attachment } from "../types";

// --- ROBUST API KEY LOADER ---
const getApiKey = () => {
  let key = '';

  // 1. Tenta via process.env (Padrão Google AI Studio / Vercel / Node)
  // Prioridade solicitada: GOOGLE_GENERATIVE_AI_API_KEY
  if (typeof process !== 'undefined' && process.env) {
      if (process.env.GOOGLE_GENERATIVE_AI_API_KEY) return process.env.GOOGLE_GENERATIVE_AI_API_KEY;
      if (process.env.GOOGLE_AI_API_KEY) return process.env.GOOGLE_AI_API_KEY;
      if (process.env.VITE_GOOGLE_AI_API_KEY) return process.env.VITE_GOOGLE_AI_API_KEY;
      if (process.env.REACT_APP_GOOGLE_AI_API_KEY) return process.env.REACT_APP_GOOGLE_AI_API_KEY;
  }

  // 2. Fallback: Tenta via VITE (Client-side standard)
  try {
    // @ts-ignore
    if (import.meta && import.meta.env) {
       // @ts-ignore
       if (import.meta.env.VITE_GOOGLE_AI_API_KEY) key = import.meta.env.VITE_GOOGLE_AI_API_KEY;
       // @ts-ignore
       else if (import.meta.env.GOOGLE_GENERATIVE_AI_API_KEY) key = import.meta.env.GOOGLE_GENERATIVE_AI_API_KEY;
       // @ts-ignore
       else if (import.meta.env.GOOGLE_AI_API_KEY) key = import.meta.env.GOOGLE_AI_API_KEY;
    }
  } catch (e) {}

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
    
    if (!apiKey) {
        console.error("CRITICAL: API Key not found. Checked process.env.GOOGLE_GENERATIVE_AI_API_KEY and others.");
        throw new Error("MISSING_KEY");
    }

    const ai = new GoogleGenAI({ apiKey });

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

    return response.text || "Não foi possível gerar o texto.";
  } catch (error: any) {
    console.error("Erro Gemini Service:", error);
    if (error.message === "MISSING_KEY") {
        throw new Error("A Chave de API não foi encontrada. Configure 'GOOGLE_GENERATIVE_AI_API_KEY' nas variáveis de ambiente.");
    }
    if (error.message && (error.message.includes("API key") || error.message.includes("403"))) {
        throw new Error("Chave de API inválida ou expirada. Verifique suas configurações.");
    }
    throw new Error("Falha na comunicação com a IA. Tente novamente.");
  }
};