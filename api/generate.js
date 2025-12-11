
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
      console.error("API Key do Gemini (GOOGLE_GENERATIVE_AI_API_KEY) não configurada no servidor.");
      return res.status(500).json({ error: 'Configuração de servidor incompleta (API Key missing).' });
    }

    const ai = new GoogleGenAI({ apiKey });

    // --- CONSTRUÇÃO DO PROMPT ---
    const contextPrompt = contextInfo ? `
      CONTEXTO ESTRUTURAL OBRIGATÓRIO (SEGUIR RIGOROSAMENTE):
      O usuário navegou e selecionou especificamente as seguintes categorias na plataforma:
      1. ÁREA DO DIREITO: ${contextInfo.area}
         - Definição da Área: ${contextInfo.areaDescription}
      2. ESPÉCIE DOCUMENTAL: ${contextInfo.species}
      
      DATA DE EMISSÃO: ${contextInfo.currentDate} (Use esta data no cabeçalho ou fechamento se necessário).
      
      INSTRUÇÃO DE ALINHAMENTO JURÍDICO:
      O texto gerado DEVE pertencer estritamente à área de "${contextInfo.area}". 
      Use terminologia, leis e estrutura jurídica específicas para "${contextInfo.species}".
      Não desvie para outras áreas do direito.
    ` : '';

    const promptText = `
      ATUAR COMO: Advogado Sênior Especialista em Direito Brasileiro e Gramático da Língua Portuguesa.
      TAREFA: Redigir uma Notificação Extrajudicial completa, técnica e gramaticalmente perfeita.
      
      ${contextPrompt}

      DADOS DE INPUT DO USUÁRIO:
      - Destinatário (Nome Curto): ${recipient}
      - Assunto Geral: ${subject}
      - Tom de Voz: ${tone}
      
      ---
      INFORMAÇÕES E FATOS:
      ${details}
      ---
      
      ${attachments && attachments.length > 0 ? `NOTA ADICIONAL: O usuário anexou ${attachments.length} arquivos probatórios. Cite a existência de anexos comprobatórios no corpo do texto para dar força material.` : ''}

      REGRAS DE REDAÇÃO E GRAMÁTICA (CRÍTICO):
      1. NORMA CULTA: Utilize o português brasileiro formal padrão.
      2. PONTUAÇÃO: Atenção redobrada ao uso de vírgulas, pontos e ponto-e-vírgula. Separe orações coordenadas e subordinadas corretamente.
      3. CONCORDÂNCIA E REGÊNCIA: Garanta a concordância nominal e verbal perfeita. Verifique a regência de verbos jurídicos (ex: "implicar em" vs "implicar algo").
      4. ORTOGRAFIA: Sem erros de digitação ou ortografia.
      5. COESÃO E COERÊNCIA: O texto deve fluir logicamente, com conectivos adequados entre os parágrafos.

      ESTRUTURA DO DOCUMENTO (TEXTO PLANO OBRIGATÓRIO - SEM MARKDOWN):
      Não use negrito (**), itálico (*) ou headers (#). Use APENAS CAIXA ALTA para destacar títulos e seções importantes.
      
      1. CABEÇALHO (Local e Data atual: ${contextInfo?.currentDate || 'Data de Hoje'})
      2. PREÂMBULO (Identificação COMPLETA das partes usando os dados fornecidos. Inclua endereço, CPF/CNPJ e contatos EXATAMENTE como fornecidos.)
      3. DOS FATOS (Narrativa detalhada, técnica e cronológica dos acontecimentos)
      4. DO DIREITO (Fundamentação jurídica citando Artigos de Leis, Códigos ou Súmulas aplicáveis ao caso concreto)
      5. DOS PEDIDOS (Exigências claras, valor líquido se houver, e prazo explícito em horas ou dias úteis para cumprimento)
      6. DAS CONSEQUÊNCIAS (Medidas judiciais cabíveis em caso de inércia, incluindo perdas e danos, honorários e custas)
      7. FECHAMENTO (Expressão de encerramento formal, espaço para assinatura e dados de contato do remetente)
    `;

    const parts = [{ text: promptText }];

    // Adiciona anexos se houver
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
        systemInstruction: "Você é a 'Notify IA', uma assistente jurídica de elite. Sua prioridade absoluta é a correção gramatical e a validade jurídica. O texto deve ser sério, intimidatório (no sentido legal) e seguir rigorosamente a norma culta da língua portuguesa (uso correto de vírgulas, crases, concordância). NÃO use Markdown.",
        temperature: 0.3, // Temperatura mais baixa para ser mais preciso e menos criativo/alucinado
      }
    });

    return res.status(200).json({ text: response.text });

  } catch (error) {
    console.error("Erro na geração IA (Server):", error);
    return res.status(500).json({ error: error.message || 'Erro interno na geração do documento.' });
  }
}
