
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

import { GoogleGenAI, Modality, type GenerateContentResponse } from "@google/genai";
import { fileToDataURL, dataURLtoFile } from "../utils/imageUtils";
import * as db from '../utils/db';
import { sha256 } from '../utils/cryptoUtils';
import { orchestrate as orchestrateTool } from "./orchestrator";
import { type SmartSearchResult, type ToolId, type Toast, type VideoAspectRatio, type DetectedObject } from "../types";

// --- CONFIGURATION ---
// Set this to true when your backend (api/gemini.ts) is deployed and accessible.
const USE_BACKEND_PROXY = false;
const PROXY_ENDPOINT = '/api/gemini';

// Helper function to show a toast message
const showToast = (setToast: (toast: Toast | null) => void, message: string, type: Toast['type'] = 'info') => {
  setToast({ message, type });
};

/**
 * Analisa um erro da API Gemini e retorna uma mensagem amigável em português.
 * @param error O objeto de erro capturado da chamada da API.
 * @returns Uma string de erro amigável para o usuário.
 */
const handleGeminiError = (error: unknown): string => {
  if (error instanceof Error) {
    const message = error.message.toLowerCase();

    // Chave de API, Permissões e Faturação
    if (message.includes('api_key_invalid') || message.includes('permission_denied')) {
      return "Chave de API inválida ou não autorizada. Verifique suas credenciais no AI Studio.";
    }
    if (message.includes('billing not enabled')) {
      return "A Faturação não está ativada para o seu projeto. Por favor, ative-a no Google Cloud Console.";
    }

    // Limites de Uso (Quota e Rate Limiting)
    if (message.includes('quota') || message.includes('resource_exhausted') || message.includes('rate limit')) {
      return "Limite de solicitações atingido. Por favor, aguarde um momento e tente novamente. Se o problema persistir, verifique seu plano de uso da API.";
    }
    
    // Conteúdo Bloqueado por Políticas de Segurança
    if (message.includes('[safety]') || message.includes('blocked')) {
        return "Sua solicitação foi bloqueada por nossas políticas de segurança. O conteúdo do seu prompt ou da sua imagem pode ser o motivo. Por favor, ajuste sua solicitação.";
    }

    // Erros Específicos da Entidade (Modelo, Chave de Vídeo, etc.)
    if (message.includes('model_not_found')) {
      return "O modelo de IA solicitado não foi encontrado. Isso pode ser um problema temporário.";
    }
    if (message.includes('requested entity was not found')) {
      return "Entidade não encontrada. Se estiver usando a geração de vídeo, sua chave de API pode ser inválida. Tente selecionar outra.";
    }

    // Erros de Rede e Timeout
    if (message.includes('deadline_exceeded') || message.includes('timed out')) {
      return "A solicitação demorou muito para responder (timeout). Verifique sua conexão com a internet e tente novamente.";
    }

    // Argumento Inválido (formato de imagem, parâmetro incorreto)
    if (message.includes('invalid_argument')) {
      return "Houve um problema com os dados enviados. A imagem pode estar em um formato inválido/corrompido ou o prompt contém parâmetros incorretos. Verifique e tente novamente.";
    }

    // Erros do Servidor da API (5xx)
    if (message.includes('server error') || message.includes('internal error') || message.includes('500') || message.includes('503')) {
      return "Ocorreu um erro temporário no servidor da IA. Por favor, aguarde alguns instantes e tente novamente.";
    }

    // Fallback para outros erros da API com a mensagem original
    return `Erro inesperado na API: ${error.message}`;
  }

  // Fallback final para erros não padronizados
  return "Ocorreu um erro desconhecido na comunicação com a IA.";
};


// Initialize the Gemini client (used only when USE_BACKEND_PROXY is false or for operations not supported by proxy)
const getAI = () => new GoogleGenAI({ apiKey: process.env.API_KEY! });

/**
 * Core function to route requests either to the local SDK or the backend proxy.
 */
const executeGeminiRequest = async (params: {
    model: string;
    contents?: any; // For generateContent
    prompt?: string; // For generateImages
    config?: any;
    task?: 'generateContent' | 'generateImages';
}) => {
    const { model, contents, prompt, config, task = 'generateContent' } = params;

    if (USE_BACKEND_PROXY) {
        try {
            const response = await fetch(PROXY_ENDPOINT, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    model,
                    contents,
                    prompt,
                    config,
                    task
                }),
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(errorData.error || `Backend error: ${response.statusText}`);
            }

            return await response.json();
        } catch (error) {
            console.error("Proxy Request Failed:", error);
            throw error;
        }
    } else {
        // Direct SDK usage
        const ai = getAI();
        if (task === 'generateImages') {
             // For Imagen
             return await ai.models.generateImages({
                 model,
                 prompt: prompt!,
                 config
             });
        } else {
             // For Gemini
             return await ai.models.generateContent({
                 model,
                 contents,
                 config
             });
        }
    }
}

// --- Helper Functions ---

const generateCacheKey = async (model: string, contents: any, config?: any): Promise<string> => {
    let contentHash = '';
    if (typeof contents === 'string') {
        contentHash = await sha256(contents);
    } else if (contents && contents.parts) {
        const partHashes = await Promise.all(contents.parts.map(async (part: any) => {
            if (part.text) {
                return await sha256(part.text);
            }
            if (part.inlineData?.data) { // base64 string
                return await sha256(part.inlineData.data);
            }
            return '';
        }));
        contentHash = partHashes.join('');
    } else if (contents instanceof File) {
        const dataUrl = await fileToDataURL(contents);
        contentHash = await sha256(dataUrl);
    }
    
    const configString = config ? JSON.stringify(config) : '';
    const keyString = `${model}:${contentHash}:${configString}`;
    return await sha256(keyString);
};


/**
 * Converts a File to a GenerativePart for the Gemini API.
 */
export const fileToPart = async (file: File) => {
  const dataUrl = await fileToDataURL(file);
  const base64Data = dataUrl.split(',')[1];
  return {
    inlineData: {
      mimeType: file.type,
      data: base64Data,
    },
  };
};

/**
 * A generic function to handle Gemini API calls that return an image.
 */
export const generateImageWithGemini = async (
  model: string,
  contents: any,
  setToast: (toast: Toast | null) => void,
  config?: any
): Promise<string> => {
  const cacheKey = await generateCacheKey(model, contents, config);
  const cachedBlob = await db.loadImageFromCache(cacheKey);
  if (cachedBlob) {
    showToast(setToast, 'Resultado carregado do cache.', 'info');
    return fileToDataURL(new File([cachedBlob], 'cached.png', { type: cachedBlob.type }));
  }

  try {
    const response = await executeGeminiRequest({
        model,
        contents,
        config,
        task: 'generateContent'
    });

    // FIX: Add robust error handling for blocked prompts and empty candidates.
    // 1. Check for top-level blocking from safety settings or other reasons.
    if (response.promptFeedback?.blockReason) {
      throw new Error(
        `Sua solicitação foi bloqueada: ${response.promptFeedback.blockReason}.`
      );
    }

    const candidate = response.candidates?.[0];

    // 2. Ensure a candidate exists. If not, the response is empty or was blocked
    // without a specific promptFeedback reason.
    if (!candidate) {
        throw new Error("A API não retornou uma resposta válida. A resposta pode estar vazia ou ter sido bloqueada por razões de segurança.");
    }

    // 3. Check for image data in the parts.
    if (candidate.content?.parts && Array.isArray(candidate.content.parts)) {
      for (const part of candidate.content.parts) {
        if (part.inlineData?.data && part.inlineData.mimeType.startsWith('image/')) {
          const mimeType = part.inlineData.mimeType;
          const dataUrl = `data:${mimeType};base64,${part.inlineData.data}`;
          
          const resultFile = dataURLtoFile(dataUrl, 'cached-result.png');
          await db.saveImageToCache(cacheKey, resultFile);

          return dataUrl;
        }
      }
    }
    
    // 4. If no image is found, check for a specific finish reason like SAFETY.
    if (candidate.finishReason === 'SAFETY') {
      const blockedRating = candidate.safetyRatings?.find((r: any) => r.blocked);
      const reason = blockedRating ? `Conteúdo bloqueado: ${blockedRating.category}.` : 'A resposta foi bloqueada por razões de segurança.';
      throw new Error(reason);
    }

    // 5. If there's still no image, check if the model returned text instead.
    const textResponse = response.text; // The SDK getter might not be available on raw JSON, handle access carefully
    // If using proxy, response is a plain object, we need to extract text manually if the getter isn't there
    const extractedText = typeof response.text === 'string' ? response.text : candidate.content?.parts?.[0]?.text;
    
    if (extractedText) {
        throw new Error(`A API retornou uma mensagem de texto em vez de uma imagem: "${extractedText}"`);
    }

    // 6. Final fallback if the candidate exists but contains no usable content.
    throw new Error("A imagem gerada não foi encontrada na resposta da API.");

  } catch (error) {
    console.error("Erro na chamada da API Gemini:", error);
    const userFriendlyError = handleGeminiError(error);
    showToast(setToast, userFriendlyError, 'error');
    throw error;
  }
};


// --- Service Functions ---

export const analyzeImage = async (imageFile: File, question: string, setToast: (toast: Toast | null) => void): Promise<string | undefined> => {
  try {
    const imagePart = await fileToPart(imageFile);
    const textPart = { text: question };
    
    const response = await executeGeminiRequest({
      model: 'gemini-2.5-pro',
      contents: { parts: [imagePart, textPart] },
      config: {
        thinkingConfig: { thinkingBudget: 32768 },
      },
      task: 'generateContent'
    });

    // Handle SDK response object or Proxy plain object
    if (response.text && typeof response.text === 'function') {
        return response.text();
    } else if (typeof response.text === 'string') {
        return response.text;
    } else {
        return response.candidates?.[0]?.content?.parts?.[0]?.text;
    }

  } catch (error) {
    console.error("Erro na análise da imagem:", error);
    const userFriendlyError = handleGeminiError(error);
    showToast(setToast, userFriendlyError, 'error');
    return undefined;
  }
};

export const generateImageFromText = async (prompt: string, aspectRatio: string, setToast: (toast: Toast | null) => void, setLoadingMessage: (message: string | null) => void): Promise<string> => {
    setLoadingMessage("Gerando imagem com Imagen...");

    const cacheKey = await sha256(`imagen-4.0-generate-001:${prompt}:${aspectRatio}`);
    const cachedBlob = await db.loadImageFromCache(cacheKey);
    if (cachedBlob) {
        setLoadingMessage(null);
        showToast(setToast, 'Imagem carregada do cache.', 'info');
        return fileToDataURL(new File([cachedBlob], "cached.png", { type: cachedBlob.type }));
    }

    try {
        const response = await executeGeminiRequest({
            model: 'imagen-4.0-generate-001',
            prompt: prompt,
            config: {
              numberOfImages: 1,
              aspectRatio: aspectRatio as any,
            },
            task: 'generateImages'
        });

        const base64ImageBytes = response.generatedImages[0].image.imageBytes;
        const dataUrl = `data:image/png;base64,${base64ImageBytes}`;
        
        const resultFile = dataURLtoFile(dataUrl, 'cached-imagen.png');
        await db.saveImageToCache(cacheKey, resultFile);

        return dataUrl;
    } catch (error) {
        console.error("Erro na geração de imagem com Imagen:", error);
        const userFriendlyError = handleGeminiError(error);
        showToast(setToast, userFriendlyError, 'error');
        throw error; // Re-throw to allow UI to handle loading state
    }
};

export const generateImageVariation = async (imageFile: File, strength: number, setToast: (toast: Toast | null) => void): Promise<string> => {
    const imagePart = await fileToPart(imageFile);
    return generateImageWithGemini(
        'gemini-2.5-flash-image',
        { parts: [imagePart] },
        setToast,
        {
          responseModalities: [Modality.IMAGE],
          // Strength is not a direct parameter, this is a conceptual mapping.
          // We can't directly control variation strength this way.
          // This will just generate a similar image.
        }
    );
};


export const validatePromptSpecificity = async (prompt: string, toolName: string): Promise<{ isSpecific: boolean; suggestion: string }> => {
  const validationPrompt = `Analise o seguinte prompt de usuário para uma ferramenta de IA chamada "${toolName}": "${prompt}". O prompt é específico o suficiente para gerar um resultado de alta qualidade? Responda com um objeto JSON com duas chaves: "isSpecific" (um booleano) e "suggestion" (uma string em português que sugere como melhorar o prompt se ele não for específico, ou uma mensagem de confirmação se for).`;

  try {
    // Validation is quick, can use proxy or direct
    const response = await executeGeminiRequest({
        model: 'gemini-2.5-flash',
        contents: validationPrompt,
        config: {
            responseMimeType: 'application/json'
        }
    });
    
    let jsonText;
    if (typeof response.text === 'function') {
        jsonText = response.text();
    } else if (typeof response.text === 'string') {
        jsonText = response.text;
    } else {
        jsonText = response.candidates?.[0]?.content?.parts?.[0]?.text;
    }

    const result = JSON.parse(jsonText.trim());
    return {
        isSpecific: result.isSpecific ?? false,
        suggestion: result.suggestion ?? "Não foi possível validar o prompt."
    };
  } catch(e) {
      console.error("Error validating prompt:", e);
      // Proceed without validation on error
      return { isSpecific: true, suggestion: "Validação falhou; prosseguindo." };
  }
};

export const removeBackground = async (imageFile: File, options: any, setToast: (toast: Toast | null) => void): Promise<string> => {
    const prompt = `Remova o fundo desta imagem, preservando todos os detalhes do objeto principal, incluindo cabelos finos ou pelos. O resultado deve ser um PNG com fundo transparente.`;
    const imagePart = await fileToPart(imageFile);
    return generateImageWithGemini('gemini-2.5-flash-image', { parts: [imagePart, { text: prompt }] }, setToast, { responseModalities: [Modality.IMAGE] });
};

export const createTransparentPng = async (imageFile: File, options: any, setToast: (toast: Toast | null) => void): Promise<string> => {
    return removeBackground(imageFile, options, setToast); // It's the same core operation
};

export const reacenderImage = async (imageFile: File, prompt: string, setToast: (toast: Toast | null) => void): Promise<string> => {
    const fullPrompt = `Reacenda esta foto. A nova iluminação deve ser: ${prompt}. Mantenha o conteúdo da imagem original, alterando apenas a luz e as sombras.`;
    const imagePart = await fileToPart(imageFile);
    return generateImageWithGemini('gemini-2.5-flash-image', { parts: [imagePart, { text: fullPrompt }] }, setToast, { responseModalities: [Modality.IMAGE] });
};

export const generateLowPoly = async (imageFile: File, setToast: (toast: Toast | null) => void): Promise<string> => {
    const prompt = 'Transforme esta imagem em uma arte de estilo low poly, usando uma malha de polígonos geométricos e cores simplificadas.';
    const imagePart = await fileToPart(imageFile);
    return generateImageWithGemini('gemini-2.5-flash-image', { parts: [imagePart, { text: prompt }] }, setToast, { responseModalities: [Modality.IMAGE] });
};

export const extractArt = async (imageFile: File, setToast: (toast: Toast | null) => void): Promise<string> => {
    const prompt = 'Extraia a arte de linha desta imagem, criando um esboço de contorno em preto e branco com um fundo branco limpo.';
    const imagePart = await fileToPart(imageFile);
    return generateImageWithGemini('gemini-2.5-flash-image', { parts: [imagePart, { text: prompt }] }, setToast, { responseModalities: [Modality.IMAGE] });
};

export const applyDustAndScratches = async (imageFile: File, setToast: (toast: Toast | null) => void): Promise<string> => {
    const prompt = 'Adicione um efeito realista de poeira, arranhões e grão de filme a esta imagem para dar uma aparência vintage.';
    const imagePart = await fileToPart(imageFile);
    return generateImageWithGemini('gemini-2.5-flash-image', { parts: [imagePart, { text: prompt }] }, setToast, { responseModalities: [Modality.IMAGE] });
};

export const denoiseImage = async (imageFile: File, setToast: (toast: Toast | null) => void): Promise<string> => {
    const prompt = 'Remova o ruído e a granulação desta imagem, preservando os detalhes finos e a nitidez.';
    const imagePart = await fileToPart(imageFile);
    return generateImageWithGemini('gemini-2.5-flash-image', { parts: [imagePart, { text: prompt }] }, setToast, { responseModalities: [Modality.IMAGE] });
};

export const applyFaceRecovery = async (imageFile: File, setToast: (toast: Toast | null) => void): Promise<string> => {
    const prompt = 'Restaure e melhore os detalhes faciais nesta imagem. Aumente a clareza, corrija imperfeições e melhore a qualidade geral do rosto.';
    const imagePart = await fileToPart(imageFile);
    return generateImageWithGemini('gemini-2.5-flash-image', { parts: [imagePart, { text: prompt }] }, setToast, { responseModalities: [Modality.IMAGE] });
};

export const generateProfessionalPortrait = async (imageFile: File, setToast: (toast: Toast | null) => void): Promise<string> => {
    const prompt = 'Transforme esta foto em um retrato profissional de negócios. Mantenha o rosto da pessoa, mas gere roupas de negócios, um fundo de escritório desfocado e iluminação de estúdio.';
    const imagePart = await fileToPart(imageFile);
    return generateImageWithGemini('gemini-2.5-flash-image', { parts: [imagePart, { text: prompt }] }, setToast, { responseModalities: [Modality.IMAGE] });
};

export const restorePhoto = async (imageFile: File, colorize: boolean, setToast: (toast: Toast | null) => void): Promise<string> => {
    let prompt = 'Restaure esta foto antiga. Remova arranhões, rasgos e ruído. Melhore a nitidez e os detalhes, especialmente nos rostos.';
    if (colorize) {
        prompt += ' Se a foto for em preto e branco, adicione cores realistas.';
    }
    const imagePart = await fileToPart(imageFile);
    return generateImageWithGemini('gemini-2.5-flash-image', { parts: [imagePart, { text: prompt }] }, setToast, { responseModalities: [Modality.IMAGE] });
};

export const upscaleImage = async (imageFile: File, factor: number, preserveFace: boolean, setToast: (toast: Toast | null) => void): Promise<string> => {
    const prompt = `Aumente a resolução desta imagem em ${factor}x. Melhore a nitidez e os detalhes. ${preserveFace ? 'Preste atenção especial para preservar e aprimorar os detalhes faciais de forma realista.' : ''}`;
    const imagePart = await fileToPart(imageFile);
    return generateImageWithGemini('gemini-2.5-flash-image', { parts: [imagePart, { text: prompt }] }, setToast, { responseModalities: [Modality.IMAGE] });
};

export const unblurImage = async (imageFile: File, sharpenLevel: number, denoiseLevel: number, model: string, setToast: (toast: Toast | null) => void): Promise<string> => {
    const prompt = `Corrija o desfoque nesta imagem usando o modelo '${model}'. Aplique ${sharpenLevel}% de nitidez e ${denoiseLevel}% de redução de ruído.`;
    const imagePart = await fileToPart(imageFile);
    return generateImageWithGemini('gemini-2.5-flash-image', { parts: [imagePart, { text: prompt }] }, setToast, { responseModalities: [Modality.IMAGE] });
};

export const applyStyle = async (imageFile: File, stylePrompt: string, setToast: (toast: Toast | null) => void): Promise<string> => {
    const prompt = `Reimagine esta imagem no seguinte estilo: ${stylePrompt}. Preserve os elementos principais, mas aplique a estética descrita.`;
    const imagePart = await fileToPart(imageFile);
    return generateImageWithGemini('gemini-2.5-flash-image', { parts: [imagePart, { text: prompt }] }, setToast, { responseModalities: [Modality.IMAGE] });
};

export const generativeEdit = async (imageFile: File, prompt: string, mode: 'fill' | 'remove', options: { maskImage: File }, setToast: (toast: Toast | null) => void): Promise<string> => {
    const fullPrompt = mode === 'remove'
        ? 'Remova o objeto ou área indicada pela máscara e preencha o espaço de forma realista e coerente com o resto da imagem.'
        : `Na área indicada pela máscara, preencha com o seguinte: ${prompt}. O resultado deve se misturar perfeitamente com o resto da imagem.`;

    const imagePart = await fileToPart(imageFile);
    const maskPart = await fileToPart(options.maskImage);
    const parts = [imagePart, maskPart, { text: fullPrompt }];
    return generateImageWithGemini('gemini-2.5-flash-image', { parts }, setToast, { responseModalities: [Modality.IMAGE] });
};

export const applyStyleToImage = async (imageFile: File, prompt: string, setToast: (toast: Toast | null) => void): Promise<string> => {
    const imagePart = await fileToPart(imageFile);
    return generateImageWithGemini('gemini-2.5-flash-image', { parts: [imagePart, { text: prompt }] }, setToast, { responseModalities: [Modality.IMAGE] });
};

export const detectObjects = async (imageFile: File, prompt?: string): Promise<DetectedObject[]> => {
    // NOTE: detectObjects returns structured data, so using the proxy requires careful JSON parsing of the response text
    // if not natively handled. For simplicity, we keep it direct via SDK or wrapped via proxy if response structure matches.
    const imagePart = await fileToPart(imageFile);
    const textPart = { text: `Detecte os seguintes objetos na imagem: ${prompt || 'todos os objetos principais'}. Para cada objeto, forneça um 'label' (rótulo em português) e uma 'box' (caixa delimitadora com coordenadas normalizadas x_min, y_min, x_max, y_max). Retorne um array de objetos JSON.` };
    
    const response = await executeGeminiRequest({
        model: 'gemini-2.5-pro',
        contents: { parts: [imagePart, textPart] },
        config: { responseMimeType: 'application/json' },
        task: 'generateContent'
    });
    
    try {
        // Handle potential differences in response structure between SDK and Proxy
        let jsonText;
        if (typeof response.text === 'function') {
            jsonText = response.text();
        } else if (typeof response.text === 'string') {
            jsonText = response.text;
        } else {
            jsonText = response.candidates?.[0]?.content?.parts?.[0]?.text;
        }

        const result = JSON.parse(jsonText);
        if (Array.isArray(result)) {
            // Filter out any objects that don't have a valid 'box' property with all coordinates
            const validObjects = result.filter(obj => 
                obj &&
                typeof obj === 'object' &&
                obj.box &&
                typeof obj.box.x_min === 'number' &&
                typeof obj.box.y_min === 'number' &&
                typeof obj.box.x_max === 'number' &&
                typeof obj.box.y_max === 'number'
            );
            return validObjects;
        }
    } catch (e) {
        console.error("Failed to parse Gemini response for object detection:", e);
        return []; // Return empty array on parsing error
    }
    
    return [];
};

export const detectFaces = async (imageFile: File): Promise<DetectedObject[]> => {
    return detectObjects(imageFile, 'todos os rostos de pessoas');
};

export const retouchFace = async (imageFile: File, maskFile: File, setToast: (toast: Toast | null) => void): Promise<string> => {
    const prompt = 'Na área indicada pela máscara, retoque a pele do rosto. Suavize imperfeições, uniformize o tom de pele e reduza o brilho, mantendo uma aparência natural e preservando a textura da pele.';
    const imagePart = await fileToPart(imageFile);
    const maskPart = await fileToPart(maskFile);
    return generateImageWithGemini('gemini-2.5-flash-image', { parts: [imagePart, maskPart, { text: prompt }] }, setToast, { responseModalities: [Modality.IMAGE] });
};

export const faceSwap = async (targetImageFile: File, sourceImageFile: File, userPrompt: string, negativePrompt: string, setToast: (toast: Toast | null) => void, maskFile?: File): Promise<string> => {
    let prompt = `**Tarefa: Troca de Rosto Fotorrealista**

Sua tarefa é executar uma troca de rosto de alta qualidade e perfeitamente integrada. Você receberá duas imagens principais: a "Imagem Alvo" (a primeira imagem na sequência) e a "Imagem Fonte" (a segunda imagem na sequência).

**Objetivo Principal:** Substitua a cabeça e a identidade da pessoa na **Imagem Alvo** pela cabeça e identidade da pessoa da **Imagem Fonte**. O resultado final deve ser uma única imagem fotorrealista, como se a pessoa da Imagem Fonte estivesse originalmente na cena da Imagem Alvo.

**REGRAS CRÍTICAS E INVIOLÁVEIS:**

1.  **PRESERVAÇÃO DO ALVO:** O corpo (do pescoço para baixo), roupas, acessórios e o fundo da **Imagem Alvo** DEVEM permanecer **100% INALTERADOS**. A modificação ocorre APENAS na área da cabeça e pescoço.

2.  **TRANSFERÊNCIA DA FONTE:** A **identidade completa** da cabeça da pessoa na **Imagem Fonte** deve ser transferida para a cabeça da pessoa na Imagem Alvo. Isso inclui:
    *   **Estrutura Facial:** Olhos, nariz, boca, formato do rosto.
    *   **Cabelo:** Estilo, cor e textura completos.
    *   **Orelhas e Pescoço:** As orelhas e a forma geral do pescoço devem ser transferidos, com uma transição invisível para o corpo alvo.
    *   **Marcas Únicas:** Todas as pintas, cicatrizes e outras marcas faciais da Imagem Fonte devem ser mantidas.

3.  **MÉTODO: INTEGRAÇÃO, NÃO COLAGEM (FALHA CRÍTICA SE IGNORADO):**
    *   **NÃO** recorte e cole a cabeça da Imagem Fonte sobre a Imagem Alvo. Isso é um erro.
    *   Em vez disso, você deve **RECONSTRUIR** a cabeça da pessoa na Imagem Alvo para que ela se pareça com a pessoa da Imagem Fonte. A nova cabeça deve ser gerada no lugar da antiga, adotando suas proporções e iluminação.
    *   **PROPORÇÃO:** A cabeça resultante deve ter a mesma escala, proporção e ângulo da cabeça original na Imagem Alvo. Evite a todo custo o efeito de "cabeça grande", "cabeça pequena" ou "cabeça flutuante".
    *   **ILUMINAÇÃO:** A iluminação na nova cabeça (direção, cor, intensidade das sombras) deve corresponder **PERFEITAMENTE** à iluminação do corpo e do cenário da Imagem Alvo.
    *   **PELE:** O tom e a textura da pele do pescoço devem se fundir **SEM EMENDAS** com a pele do corpo na Imagem Alvo. Não deve haver nenhuma linha de demarcação visível.

**Instruções de entrada de imagem:**
- **Primeira Imagem:** Imagem Alvo (a que será modificada).
- **Segunda Imagem:** Imagem Fonte (de onde a identidade será copiada).
`;

    if (maskFile) {
        prompt += `
- **Terceira Imagem (Máscara):** Uma máscara é fornecida. A troca de rosto deve ocorrer **ESTRITAMENTE DENTRO DA ÁREA BRANCA** desta máscara na Imagem Alvo. Ignore completamente a área preta.
`;
    }

    prompt += `
**MODIFICAÇÕES DO USUÁRIO:**
-   Instruções adicionais: "${userPrompt || 'Nenhuma instrução adicional.'}"
-   Coisas a evitar: "${negativePrompt || 'Nenhuma instrução negativa.'}"

**SAÍDA:**
Uma única imagem fotorrealista de alta qualidade com a troca de identidade concluída de acordo com todas as regras.
`;

    const targetPart = await fileToPart(targetImageFile);
    const sourcePart = await fileToPart(sourceImageFile);
    // FIX: Explicitly type `parts` array to allow both image and text parts.
    const parts: ({ text: string; } | { inlineData: { data: string; mimeType: string; }; })[] = [targetPart, sourcePart];

    if (maskFile) {
        const maskPart = await fileToPart(maskFile);
        parts.push(maskPart);
    }
    parts.push({ text: prompt });

    return generateImageWithGemini(
        'gemini-2.5-flash-image',
        { parts },
        setToast,
        { responseModalities: [Modality.IMAGE] }
    );
};

export const generateVideo = async (imageFile: File, prompt: string, aspectRatio: VideoAspectRatio, setToast: (toast: Toast | null) => void, setLoadingMessage: (message: string | null) => void): Promise<string> => {
    // NOTE: generateVideos operations are complex (polling) and usually require client-side handling or a more sophisticated backend.
    // For now, we keep this using the direct SDK to avoid complexity in the proxy.
    const ai = getAI();
    let operation;
    try {
        const imagePart = await fileToPart(imageFile);
        operation = await ai.models.generateVideos({
            model: 'veo-3.1-fast-generate-preview',
            prompt,
            image: { imageBytes: imagePart.inlineData.data, mimeType: imagePart.inlineData.mimeType },
            config: {
                numberOfVideos: 1,
                resolution: '720p',
                aspectRatio: aspectRatio,
            },
        });

        while (!operation.done) {
            await new Promise(resolve => setTimeout(resolve, 10000));
            operation = await ai.operations.getVideosOperation({ operation: operation });
        }

        const downloadLink = operation.response?.generatedVideos?.[0]?.video?.uri;
        if (!downloadLink) throw new Error("Link para download do vídeo não encontrado.");
        
        const response = await fetch(`${downloadLink}&key=${process.env.API_KEY}`);
        const blob = await response.blob();
        return URL.createObjectURL(blob);
    } catch (error) {
        console.error("Erro na geração de vídeo:", error);
        const userFriendlyError = handleGeminiError(error);
        showToast(setToast, userFriendlyError, 'error');
        throw error;
    }
};

export const suggestToolFromPrompt = async (prompt: string): Promise<SmartSearchResult | null> => {
    return orchestrateTool(prompt);
};

export const generateAdjustedImage = async (imageFile: File, prompt: string, setToast: (toast: Toast | null) => void): Promise<string> => {
    const fullPrompt = `Ajuste esta imagem com base na seguinte descrição: "${prompt}". Mantenha o conteúdo da imagem, alterando apenas as cores e a luz.`;
    const imagePart = await fileToPart(imageFile);
    return generateImageWithGemini('gemini-2.5-flash-image', { parts: [imagePart, { text: fullPrompt }] }, setToast, { responseModalities: [Modality.IMAGE] });
};

export const outpaintImage = async (imageFile: File, prompt: string, aspectRatio: string, setToast: (toast: Toast | null) => void): Promise<string> => {
    const fullPrompt = `Expanda esta imagem para uma proporção de ${aspectRatio}. Preencha as novas áreas com o seguinte conteúdo: ${prompt || 'continue a imagem de forma coerente'}.`;
    const imagePart = await fileToPart(imageFile);
    return generateImageWithGemini('gemini-2.5-flash-image', { parts: [imagePart, { text: fullPrompt }] }, setToast, { responseModalities: [Modality.IMAGE] });
};

export const generateImageFromParts = async (parts: any[], setToast: (toast: Toast | null) => void): Promise<string> => {
    return generateImageWithGemini('gemini-2.5-flash-image', { parts }, setToast, { responseModalities: [Modality.IMAGE] });
};

export const generateImageWithDescription = async (imageFile: File, description: string, setToast: (toast: Toast | null) => void): Promise<string> => {
    const imagePart = await fileToPart(imageFile);
    const textPart = { text: description };
    return generateImageFromParts([imagePart, textPart], setToast);
};

// FIX: Awaits file-to-part conversion before calling generateImageFromParts.
export const generateSuperheroFusion = async (person: File, hero: File, setToast: (toast: Toast | null) => void): Promise<string> => {
    const prompt = "Faça a fusão da pessoa na primeira imagem com o super-herói na segunda imagem. Mantenha o rosto da primeira pessoa, mas aplique o traje e o estilo do herói.";
    const personPart = await fileToPart(person);
    const heroPart = await fileToPart(hero);
    return generateImageFromParts([personPart, heroPart, { text: prompt }], setToast);
};

export const generateCreativeFusion = async (compositionFile: File, styleFiles: File[], setToast: (toast: Toast | null) => void): Promise<string> => {
    const prompt = "Use a composição da primeira imagem e aplique o estilo das imagens seguintes.";
    const parts = await Promise.all([fileToPart(compositionFile), ...styleFiles.map(fileToPart)]);
    return generateImageFromParts([...parts, { text: prompt }], setToast);
};

export const generateAIPortrait = async (style: string, personImages: File[], prompt: string, setToast: (toast: Toast | null) => void): Promise<string> => {
    const fullPrompt = `Crie um retrato no estilo '${style}' usando a(s) pessoa(s) da(s) imagem(ns). Instruções adicionais: ${prompt}`;
    const imageParts = await Promise.all(personImages.map(fileToPart));
    return generateImageFromParts([...imageParts, { text: fullPrompt }], setToast);
};

export const generateMagicMontage = async (imageFile: File, prompt: string, sourceImageFile: File, setToast: (toast: Toast | null) => void): Promise<string> => {
    const fullPrompt = `Execute a seguinte montagem: ${prompt}. Use a primeira imagem como base e a segunda imagem como fonte, se necessário.`;
    const parts = await Promise.all([fileToPart(imageFile), fileToPart(sourceImageFile)]);
    return generateImageFromParts([...parts, { text: fullPrompt }], setToast);
};

export const generateDoubleExposure = async (portraitFile: File, landscapeFile: File, setToast: (toast: Toast | null) => void): Promise<string> => {
    const prompt = "Crie um efeito de dupla exposição. Mescle a imagem de paisagem (segunda imagem) dentro da silhueta do retrato (primeira imagem).";
    const parts = await Promise.all([fileToPart(portraitFile), fileToPart(landscapeFile)]);
    return generateImageFromParts([...parts, { text: prompt }], setToast);
};

export const getSceneryDescription = async (sceneryPrompt: string, setToast: (toast: Toast | null) => void): Promise<string> => {
    // This is text-only generation, candidate for proxy
    try {
        const response = await executeGeminiRequest({
            model: 'gemini-2.5-flash',
            contents: `O usuário quer colocar um objeto em um cenário. O prompt dele é: "${sceneryPrompt}". Transforme o prompt do usuário em uma descrição de cenário rica e detalhada para um gerador de imagens. Retorne apenas a descrição do cenário.`,
            task: 'generateContent'
        });
        
        if (typeof response.text === 'string') return response.text;
        return response.candidates?.[0]?.content?.parts?.[0]?.text || '';
    } catch(error) {
        showToast(setToast, handleGeminiError(error), 'error');
        throw error;
    }
};

export const generateProductPhoto = async (objectFile: File, sceneryPrompt: string, setToast: (toast: Toast | null) => void, setLoadingMessage: (message: string | null) => void): Promise<string> => {
    const prompt = `Coloque o objeto da imagem em um novo cenário descrito por: "${sceneryPrompt}". A iluminação no objeto deve corresponder à iluminação do novo cenário. O resultado deve ser fotorrealista.`;
    const imagePart = await fileToPart(objectFile);
    return generateImageWithGemini('gemini-2.5-flash-image', { parts: [imagePart, { text: prompt }] }, setToast, { responseModalities: [Modality.IMAGE] });
};

export const generateAnimationFromImage = async (imageFile: File, prompt: string, aspectRatio: VideoAspectRatio, setToast: (toast: Toast | null) => void, setLoadingMessage: (message: string | null) => void): Promise<string> => {
    const cacheKey = await generateCacheKey('veo-3.1-fast-generate-preview', imageFile, { prompt, aspectRatio });
    const cachedBlob = await db.loadImageFromCache(cacheKey);
    if (cachedBlob) {
        showToast(setToast, 'Animação carregada do cache.', 'info');
        return URL.createObjectURL(cachedBlob);
    }
    const resultUrl = await generateVideo(imageFile, prompt, aspectRatio, setToast, setLoadingMessage);
    const response = await fetch(resultUrl);
    const blob = await response.blob();
    await db.saveImageToCache(cacheKey, blob);
    URL.revokeObjectURL(resultUrl); // Clean up the initial blob URL
    return URL.createObjectURL(blob);
};

export const generateCharacter = (prompt: string, setToast: (toast: Toast | null) => void, setLoadingMessage: (message: string | null) => void) => generateImageFromText(prompt, '9:16', setToast, setLoadingMessage);
export const generateLogo = (prompt: string, setToast: (toast: Toast | null) => void, setLoadingMessage: (message: string | null) => void) => generateImageFromText(`logotipo vetorial minimalista, linhas simples e limpas, cores chapadas, alto contraste, adequado para uma marca, centrado em um fundo branco. Conceito: ${prompt}`, '1:1', setToast, setLoadingMessage);
export const generateSeamlessPattern = (prompt: string, setToast: (toast: Toast | null) => void, setLoadingMessage: (message: string | null) => void) => generateImageFromText(`padrão sem costura repetitivo. ${prompt}`, '1:1', setToast, setLoadingMessage);
export const generate3DModel = (prompt: string, setToast: (toast: Toast | null) => void, setLoadingMessage: (message: string | null) => void) => generateImageFromText(`renderização de modelo 3D fotorrealista de ${prompt}, iluminação de estúdio, fundo neutro.`, '1:1', setToast, setLoadingMessage);

export const generateSticker = async (prompt: string, imageFile: File | undefined, setToast: (toast: Toast | null) => void, setLoadingMessage: (message: string | null) => void): Promise<string> => {
    const fullPrompt = `Crie um adesivo de vinil em estilo cartoon com uma borda branca espessa e um leve sombreamento. ${prompt}`;
    if (imageFile) {
        const imagePart = await fileToPart(imageFile);
        return generateImageWithGemini('gemini-2.5-flash-image', { parts: [imagePart, { text: fullPrompt }] }, setToast, { responseModalities: [Modality.IMAGE] });
    }
    return generateImageFromText(fullPrompt, '1:1', setToast, setLoadingMessage);
};

export const applyTextEffect = async (imageFile: File, prompt: string, setToast: (toast: Toast | null) => void): Promise<string> => {
    const fullPrompt = `Aplique o seguinte efeito apenas ao texto na imagem: ${prompt}. Não altere o fundo ou outras partes da imagem.`;
    const imagePart = await fileToPart(imageFile);
    return generateImageWithGemini('gemini-2.5-flash-image', { parts: [imagePart, { text: fullPrompt }] }, setToast, { responseModalities: [Modality.IMAGE] });
};

export const convertToVector = async (imageFile: File, prompt: string, setToast: (toast: Toast | null) => void): Promise<string> => {
    const fullPrompt = `Converta a imagem em uma ilustração vetorial limpa com um contorno branco espesso, como um adesivo. Instruções de estilo adicionais: ${prompt}`;
    const imagePart = await fileToPart(imageFile);
    return generateImageWithGemini('gemini-2.5-flash-image', { parts: [imagePart, { text: fullPrompt }] }, setToast, { responseModalities: [Modality.IMAGE] });
};

export const generateInteriorDesign = async (imageFile: File, maskFile: File, roomType: string, roomStyle: string, prompt: string, setToast: (toast: Toast | null) => void): Promise<string> => {
    const fullPrompt = `Você é um designer de interiores de IA. Na área da imagem indicada pela máscara, redesenhe o espaço. Tipo de ambiente: ${roomType}. Estilo de design: ${roomStyle}. Instruções adicionais: ${prompt}. O resultado deve se misturar perfeitamente com as partes não mascaradas da imagem.`;
    const imagePart = await fileToPart(imageFile);
    const maskPart = await fileToPart(maskFile);
    return generateImageWithGemini('gemini-2.5-flash-image', { parts: [imagePart, maskPart, { text: fullPrompt }] }, setToast, { responseModalities: [Modality.IMAGE] });
};

// FIX: Add missing renderSketch function
export const renderSketch = async (imageFile: File, prompt: string, setToast: (toast: Toast | null) => void, setLoadingMessage: (message: string | null) => void): Promise<string> => {
    const fullPrompt = `Renderize este esboço em uma imagem fotorrealista com base na seguinte descrição: ${prompt}.`;
    const imagePart = await fileToPart(imageFile);
    return generateImageWithGemini('gemini-2.5-flash-image', { parts: [imagePart, { text: fullPrompt }] }, setToast, { responseModalities: [Modality.IMAGE] });
};
