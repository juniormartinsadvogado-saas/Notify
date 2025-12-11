
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
    // Prepara os anexos para envio ao backend (converte para base64 se necessário)
    const processedAttachments = [];
    if (attachments && attachments.length > 0) {
        for (const att of attachments) {
            if (att.type === 'image' || att.type === 'document') { 
                 try {
                     const base64Data = await fileToBase64(att.file);
                     processedAttachments.push({
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

    // Chamada ao Backend (Serverless Function)
    // Isso garante que a chave GOOGLE_GENERATIVE_AI_API_KEY seja lida do servidor
    const response = await fetch('/api/generate', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            recipient,
            subject,
            details,
            tone,
            attachments: processedAttachments,
            contextInfo
        })
    });

    if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.error || "Erro na comunicação com a IA.");
    }

    const data = await response.json();
    
    if (!data.text) {
        throw new Error("A IA retornou uma resposta vazia.");
    }

    return data.text;

  } catch (error: any) {
    console.error("Erro na geração IA:", error);
    throw new Error(`Falha ao gerar documento: ${error.message || 'Erro desconhecido'}`);
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
