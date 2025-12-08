import { GoogleGenAI } from "@google/genai";
import { Attachment } from "../types";

// Helper para obter API KEY de forma segura (suporta Vite, process.env e Vercel)
const getApiKey = () => {
  let key = '';
  try {
    // Tenta obter via import.meta.env (Vite standard)
    const meta = import.meta as any;
    if (typeof meta !== 'undefined' && meta.env) {
        key = meta.env.VITE_API_KEY_GEMINI || 
              meta.env.API_KEY_GEMINI || 
              meta.env.VITE_API_KEY || 
              meta.env.API_KEY || '';
    }
  } catch (e) {}

  if (!key) {
    try {
      // Fallback para process.env (Node/Vercel System Envs)
      if (typeof process !== 'undefined' && process.env) {
        key = process.env.API_KEY_GEMINI || 
              process.env.VITE_API_KEY_GEMINI || 
              process.env.API_KEY || '';
      }
    } catch (e) {}
  }
  return key;
};

const ai = new GoogleGenAI({ apiKey: getApiKey() });

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
    const key = getApiKey();
    if (!key) {
        throw new Error("API KEY não configurada. Verifique suas variáveis de ambiente.");
    }

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

      DADOS DO CASO:
      - Destinatário: ${recipient}
      - Assunto Geral: ${subject}
      - Fatos/Detalhes fornecidos pelo usuário: ${details}
      - Tom de Voz: ${tone}
      
      ${attachments.length > 0 ? `NOTA ADICIONAL: O usuário anexou ${attachments.length} arquivos probatórios. Analise o conteúdo visual/textual destes anexos se possível para enriquecer a descrição dos fatos.` : ''}

      ESTRUTURA DO DOCUMENTO (Markdown):
      1. CABEÇALHO (Local e Data atual)
      2. PREÂMBULO (Identificação das partes)
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
        systemInstruction: "Você é a 'Notify AI', assistente jurídica de elite. Você deve respeitar estritamente a ÁREA e a ESPÉCIE selecionadas pelo usuário ao criar o documento. Use formatação Markdown limpa.",
        temperature: 0.4, // Temperatura menor para ser mais preciso tecnicamente
      }
    });

    return response.text || "Não foi possível gerar o texto.";
  } catch (error: any) {
    console.error("Erro Gemini Detalhado:", error);
    if (error.message.includes("API KEY")) {
        throw new Error("Chave de API inválida ou não encontrada.");
    }
    throw new Error("Falha na comunicação com a IA. Tente novamente.");
  }
};