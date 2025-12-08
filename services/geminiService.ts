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
    if (!file.type.startsWith('image/')) return null;

    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => {
            const base64String = reader.result as string;
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
  attachments: Attachment[] = []
): Promise<string> => {
  try {
    const parts: any[] = [];
    
    const promptText = `
      ATUAR COMO: Advogado Sênior Especialista.
      TAREFA: Redigir uma Notificação Extrajudicial completa.
      
      DADOS DO CASO:
      - Destinatário: ${recipient}
      - Assunto: ${subject}
      - Detalhes: ${details}
      - Tom: ${tone}
      
      ${attachments.length > 0 ? `NOTA: O usuário anexou ${attachments.length} arquivos.` : ''}

      ESTRUTURA (Markdown):
      1. CABEÇALHO (Local e Data)
      2. PREÂMBULO
      3. DOS FATOS
      4. DO DIREITO (Citar leis brasileiras)
      5. DOS PEDIDOS (Prazo explícito)
      6. DAS CONSEQUÊNCIAS
      7. FECHAMENTO
    `;
    
    parts.push({ text: promptText });

    for (const att of attachments) {
        const imagePart = await fileToGenerativePart(att.file);
        if (imagePart) {
            parts.push(imagePart);
        }
    }

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: { parts },
      config: {
        systemInstruction: "Você é a 'Notify AI', assistente jurídica brasileira. Respostas formais em Markdown.",
        temperature: 0.5,
      }
    });

    return response.text || "Não foi possível gerar o texto.";
  } catch (error) {
    console.error("Erro Gemini:", error);
    throw new Error("Falha na comunicação com a IA.");
  }
};