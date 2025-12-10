import { GoogleGenAI } from "@google/genai";

export default async function handler(req, res) {
  // Configuração de CORS
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,POST');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
  );

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { recipient, subject, details, tone, attachments, contextInfo } = req.body;

    // Busca a chave de API nas variáveis de ambiente do servidor (Vercel)
    const apiKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY || process.env.GEMINI_API_KEY || process.env.VITE_GOOGLE_GENERATIVE_AI_API_KEY;

    if (!apiKey) {
      console.error("API Key do Gemini não configurada no servidor.");
      return res.status(500).json({ error: 'Configuração de servidor incompleta (API Key missing).' });
    }

    const ai = new GoogleGenAI({ apiKey });

    // --- RECONSTRUÇÃO DO PROMPT (Lógica movida para o backend) ---
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
      
      ${attachments && attachments.length > 0 ? `NOTA ADICIONAL: O usuário anexou ${attachments.length} arquivos probatórios. Analise o conteúdo visual/textual destes anexos se possível para enriquecer a descrição dos fatos.` : ''}

      ESTRUTURA DO DOCUMENTO (TEXTO PLANO OBRIGATÓRIO - SEM MARKDOWN):
      Não use negrito (**), itálico (*) ou headers (#). Use CAIXA ALTA para títulos se necessário.
      
      1. CABEÇALHO (Local e Data atual)
      2. PREÂMBULO (Identificação COMPLETA das partes usando os dados fornecidos. Inclua endereço, CPF/CNPJ e contatos EXATAMENTE como fornecidos.)
      3. DOS FATOS (Narrativa detalhada e técnica)
      4. DO DIREITO (Fundamentação jurídica citando Artigos de Leis, Códigos ou Súmulas aplicáveis)
      5. DOS PEDIDOS (Exigências claras com prazo explícito para cumprimento)
      6. DAS CONSEQUÊNCIAS (Medidas judiciais cabíveis)
      7. FECHAMENTO (Assinatura e contatos)
    `;

    const parts = [{ text: promptText }];

    // Adiciona anexos se houver (já devem vir em formato base64 inlineData do frontend)
    if (attachments && Array.isArray(attachments)) {
        attachments.forEach(att => {
            if (att.inlineData) {
                parts.push(att);
            }
        });
    }

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: { parts },
      config: {
        systemInstruction: "Você é a 'Notify AI', assistente jurídica de elite. Gere o texto em formato TXT puro, profissional, ideal para documentos jurídicos formais. EVITE COMPLETAMENTE O USO DE MARKDOWN (como **, ##, *). Use apenas espaçamento e caixa alta para destacar seções.",
        temperature: 0.4, 
      }
    });

    return res.status(200).json({ text: response.text });

  } catch (error) {
    console.error("Erro na geração IA (Server):", error);
    return res.status(500).json({ error: error.message || 'Erro interno na geração do documento.' });
  }
}