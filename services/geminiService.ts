import { Attachment } from "../types";

// Helper para converter arquivo em base64 para envio à API
const fileToGenerativePart = async (file: File): Promise<{ inlineData: { data: string; mimeType: string } } | null> => {
    // Permite imagens, PDFs e Vídeos
    const isImage = file.type.startsWith('image/');
    const isVideo = file.type.startsWith('video/');
    const isPdf = file.type === 'application/pdf';

    if (!isImage && !isVideo && !isPdf) {
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
    // 1. Processar anexos no cliente antes de enviar
    const processedAttachments: any[] = [];
    
    for (const att of attachments) {
        try {
            const filePart = await fileToGenerativePart(att.file);
            if (filePart) {
                processedAttachments.push(filePart);
            }
        } catch (fileError) {
            console.error("Erro ao processar anexo para envio:", fileError);
        }
    }

    // 2. Chamar a Serverless Function (Backend Vercel)
    // Isso protege a API Key e evita problemas de ambiente no navegador
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
        throw new Error(errData.error || "Erro na comunicação com o servidor de IA.");
    }

    const data = await response.json();

    if (!data.text) {
        throw new Error("Resposta vazia da IA.");
    }

    return data.text;

  } catch (error: any) {
    // Tratamento de Erro para o Usuário
    console.error("System Error (AI Generation):", error);
    throw new Error("Não foi possível gerar o documento. Verifique sua conexão ou tente novamente em instantes.");
  }
};