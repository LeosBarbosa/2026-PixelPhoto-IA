
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

import React, { useState, useEffect } from 'react';
import { useEditor } from '../../../context/EditorContext';
import ImageDropzone from './common/ImageDropzone';
import ResultViewer from './common/ResultViewer';
import TipBox from '../common/TipBox';
import CollapsibleToolPanel from '../CollapsibleToolPanel';
import PromptEnhancer from './common/PromptEnhancer';
import LazyIcon from '../LazyIcon';
import { GoogleGenAI, Modality } from '@google/genai';
import { fileToPart } from '../../../services/geminiService'; // Use shared helper

const scenePresets = [
    { name: 'Nenhum (Manter Fundo Original)', value: '' },
    { name: 'Estúdio Minimalista', value: 'Em um estúdio minimalista com um fundo cinza claro e iluminação suave.' },
    { name: 'Rua de Paris à Noite', value: 'Em uma rua charmosa de Paris à noite, com as luzes da cidade desfocadas ao fundo e o chão de paralelepípedos molhado.' },
    { name: 'Praia Tropical', value: 'Em uma praia tropical de areia branca ao pôr do sol, com palmeiras e o oceano calmo ao fundo.' },
    { name: 'Floresta Encantada', value: 'Em uma floresta encantada com árvores antigas cobertas de musgo e feixes de luz solar filtrando-se através da copa das árvores.' },
    { name: 'Café Aconchegante', value: 'Sentado em um café aconchegante com interior de madeira, iluminação quente e uma janela com vista para uma rua movimentada.' }
];

const posePresets = [
    { name: 'Padrão (Em pé)', value: 'Corpo inteiro, em pé, pose de moda, olhando confiantemente para a câmera.' },
    { name: 'Andando', value: 'Andando confiantemente em direção à câmera em uma calçada da cidade, com um leve movimento no cabelo e nas roupas.' },
    { name: 'Sentado (Casual)', value: 'Sentado em uma poltrona de couro moderna, com uma perna cruzada sobre a outra, olhando relaxadamente para o lado.' },
    { name: 'Close-up (Sorrindo)', value: 'Retrato em close-up do peito para cima, com um sorriso genuíno e natural, olhando diretamente para a câmera.' },
    { name: 'Pose de Ação', value: 'Em uma pose de ação dinâmica, como se estivesse no meio de um salto ou correndo, capturando movimento e energia.' }
];

const TryOnPanel: React.FC = () => {
    const { 
        baseImageFile,
        setInitialImage, 
        // Using context method to save to history if available, otherwise direct usage
        commitChange,
        setToast,
    } = useEditor();
    
    // Estados locais para UI
    const [isLoadingLocal, setIsLoadingLocal] = useState(false);
    const [localError, setLocalError] = useState<string | null>(null);
    const [resultUrl, setResultUrl] = useState<string | null>(null);

    const [personImage, setPersonImage] = useState<File[]>([]);
    const [clothingImage, setClothingImage] = useState<File[]>([]);
    const [shoeImage, setShoeImage] = useState<File[]>([]);

    // Estados para os prompts profissionais
    const [scenePrompt, setScenePrompt] = useState('');
    const [posePrompt, setPosePrompt] = useState('Corpo inteiro, em pé, pose de moda, olhando confiantemente para a câmera.');
    const [cameraLens, setCameraLens] = useState('lente de 50mm com abertura f/2.8 para um leve desfoque de fundo');
    const [cameraAngle, setCameraAngle] = useState('ao nível dos olhos');
    const [lightingStyle, setLightingStyle] = useState('iluminação de estúdio suave (softbox)');
    const [negativePrompt, setNegativePrompt] = useState('deformado, feio, desfigurado, mãos extras, membros extras');
    const [isOptionsExpanded, setIsOptionsExpanded] = useState(false);

    useEffect(() => {
        if (baseImageFile && personImage.length === 0) setPersonImage([baseImageFile]);
    }, [baseImageFile, personImage]);
    
    const handlePersonFileSelect = (files: File[]) => {
        setPersonImage(files);
        if (files[0]) setInitialImage(files[0]);
    };

    const handleGenerate = async () => {
        const personFile = personImage[0];
        const clothingFile = clothingImage[0];
        const shoeFile = shoeImage[0];

        if (!personFile || !clothingFile) {
            setLocalError("Por favor, carregue a foto do modelo e da roupa.");
            return;
        }

        setIsLoadingLocal(true);
        setLocalError(null);

        try {
            // Conversão para Base64 usando helper existente
            const personPart = await fileToPart(personFile);
            const clothingPart = await fileToPart(clothingFile);
            let shoePart = null;
            if (shoeFile) {
                shoePart = await fileToPart(shoeFile);
            }

            // Initialize correctly with process.env.API_KEY
            const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
            
            const parts: any[] = [personPart, clothingPart];

            if (shoePart) {
                parts.push(shoePart);
            }

            let fullPrompt = `
            ATUE COMO: Um Estilista Digital Sênior e Especialista em CGI (Computer Generated Imagery).
            
            TAREFA: Realizar um "Virtual Try-On" (Provador Virtual) Fotorrealista de Alta Fidelidade.
            
            ENTRADAS:
            - IMAGEM 1 (Modelo): Pessoa (Corpo, Pose, Tom de Pele).
            - IMAGEM 2 (Peça/Garment): A roupa a ser vestida (Textura, Caimento, Estilo).
            ${shoeFile ? '- IMAGEM 3 (Calçado): O calçado a ser vestido.' : ''}
            
            DIRETRIZES TÉCNICAS E ESTILÍSTICAS:
            1. **FÍSICA E CAIMENTO:** Aplique a roupa da Imagem 2 sobre o corpo da Imagem 1 respeitando a gravidade e a tensão do tecido. Crie dobras de compressão realistas baseadas na pose: "${posePrompt}".
            2. **PRESERVAÇÃO DE IDENTIDADE:** Mantenha o rosto, tom de pele e mãos da Imagem 1 INTACTOS.
            3. **OCLUSÃO INTELIGENTE:** Se o cabelo do modelo for longo, ele deve aparecer POR CIMA da roupa nova.
            4. **ILUMINAÇÃO (Relighting):** Projete sombras da nova roupa sobre a pele e vice-versa, baseando-se na luz original da Imagem 1 ou na nova iluminação solicitada: "${lightingStyle}".
            5. **CÂMERA E AMBIENTE:** ${scenePrompt ? `Integre o modelo realisticamente no novo cenário: "${scenePrompt}".` : "Mantenha o fundo original se possível, ou use um fundo neutro suave."} Use a configuração de câmera: ${cameraLens}, ${cameraAngle}.
            
            SAÍDA: Retorne APENAS a imagem final processada em alta resolução.
            `;

            if (negativePrompt) {
                fullPrompt += `\nEVITAR (Negative Prompt): ${negativePrompt}`;
            }

            parts.push({ text: fullPrompt });

            const response = await ai.models.generateContent({
              model: 'gemini-2.0-flash-exp', // Usando o modelo mais recente disponível
              contents: { parts },
              config: { responseModalities: [Modality.IMAGE] },
            });

            const candidate = response.candidates?.[0];
            
            // Check content.parts for the image
            let imagePart = null;
            if (candidate?.content?.parts) {
                imagePart = candidate.content.parts.find(p => p.inlineData);
            }

            if (imagePart?.inlineData) {
                const url = `data:${imagePart.inlineData.mimeType};base64,${imagePart.inlineData.data}`;
                setResultUrl(url);
                // Save to app history if commitChange is available
                // commitChange requires a File object
                fetch(url)
                    .then(res => res.blob())
                    .then(blob => {
                        const file = new File([blob], `tryon-result-${Date.now()}.png`, { type: 'image/png' });
                        commitChange(file, 'tryOn');
                    });
            } else {
                throw new Error("A IA não gerou a imagem visual. Tente ajustar os parâmetros.");
            }

        } catch (err: any) {
            console.error("Erro Try-On:", err);
            setLocalError(err.message || "Falha ao gerar o look.");
            setToast({ message: err.message || "Erro ao gerar look", type: 'error' });
        } finally {
            setIsLoadingLocal(false);
        }
    };

    const handlePresetChange = (setter: React.Dispatch<React.SetStateAction<string>>) => (e: React.ChangeEvent<HTMLSelectElement>) => {
        const value = e.target.value;
        if (value) setter(value);
        e.target.value = "";
    };

    const isGenerateButtonDisabled = isLoadingLocal || personImage.length === 0 || clothingImage.length === 0;

    return (
        <div className="p-4 md:p-6 flex flex-col md:flex-row gap-6 h-full">
            <aside className="w-full md:w-96 flex-shrink-0 bg-gray-900/30 rounded-lg p-4 flex flex-col gap-4 border border-gray-700/50 overflow-y-auto scrollbar-thin">
                <div className="text-center">
                    <h3 className="text-lg font-semibold text-gray-200">Provador Virtual PRO</h3>
                    <p className="text-sm text-gray-400 mt-1">Inteligência de Estúdio Digital.</p>
                </div>
                
                <div className="grid grid-cols-1 gap-4">
                   <ImageDropzone files={personImage} onFilesChange={handlePersonFileSelect} label="Modelo (Você)"/>
                   <ImageDropzone files={clothingImage} onFilesChange={setClothingImage} label="A Roupa"/>
                   <ImageDropzone files={shoeImage} onFilesChange={setShoeImage} label="Calçado (Opcional)"/>
                </div>

                <CollapsibleToolPanel
                    title="Direção de Estúdio (Avançado)"
                    icon="CameraIcon"
                    isExpanded={isOptionsExpanded}
                    onExpandToggle={() => setIsOptionsExpanded(!isOptionsExpanded)}
                >
                    <div className="flex flex-col gap-4">
                        {/* Controles de Prompt Profissionais */}
                        <div>
                            <label className="block text-sm font-medium text-gray-300 mb-1">Cenário</label>
                            <select onChange={handlePresetChange(setScenePrompt)} defaultValue="" className="w-full bg-gray-800 border border-gray-600 rounded-lg p-2 text-sm mb-2" disabled={isLoadingLocal}>
                                <option value="" disabled>Escolha um preset...</option>
                                {scenePresets.map(p => <option key={p.name} value={p.value}>{p.name}</option>)}
                            </select>
                            <div className="relative">
                                <textarea value={scenePrompt} onChange={e => setScenePrompt(e.target.value)} placeholder="Descreva o ambiente..." className="w-full bg-gray-800 border border-gray-600 rounded-lg p-2 pr-12 text-sm" rows={2} disabled={isLoadingLocal} />
                                <PromptEnhancer prompt={scenePrompt} setPrompt={setScenePrompt} toolId="tryOn" />
                            </div>
                        </div>
                        
                        <div>
                            <label className="block text-sm font-medium text-gray-300 mb-1">Pose do Modelo</label>
                            <select onChange={handlePresetChange(setPosePrompt)} defaultValue="" className="w-full bg-gray-800 border border-gray-600 rounded-lg p-2 text-sm mb-2" disabled={isLoadingLocal}>
                                 <option value="" disabled>Escolha a pose...</option>
                                {posePresets.map(p => <option key={p.name} value={p.value}>{p.name}</option>)}
                            </select>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-300 mb-1">Iluminação</label>
                            <select value={lightingStyle} onChange={e => setLightingStyle(e.target.value)} className="w-full bg-gray-800 border border-gray-600 rounded-lg p-2 text-sm" disabled={isLoadingLocal}>
                                <option value="iluminação de estúdio suave (softbox)">Estúdio Suave</option>
                                <option value="luz natural quente (golden hour)">Golden Hour</option>
                                <option value="iluminação dramática (noir)">Dramática</option>
                                <option value="luz de preenchimento uniforme">Luz Uniforme</option>
                            </select>
                        </div>
                    </div>
                </CollapsibleToolPanel>
                
                <TipBox>
                    A nova IA ajustará a roupa à pose e iluminação do modelo. Para melhores resultados, use fotos com boa luz.
                </TipBox>
                
                <button onClick={handleGenerate} disabled={isGenerateButtonDisabled} className="w-full mt-auto bg-gradient-to-br from-pink-600 to-purple-500 text-white font-bold py-3 px-5 rounded-lg transition-all disabled:opacity-50 flex items-center justify-center gap-2">
                    <LazyIcon name="ShirtIcon" className="w-5 h-5" />
                    {isLoadingLocal ? 'Processando...' : 'Gerar Look PRO'}
                </button>
            </aside>
            <main className="flex-grow bg-black/20 rounded-lg border border-gray-700/50 flex flex-col items-center justify-center p-4">
                <ResultViewer 
                    isLoading={isLoadingLocal} 
                    error={localError} 
                    resultImage={resultUrl || (baseImageFile ? URL.createObjectURL(baseImageFile) : null)} // Mostra o resultado ou a imagem atual
                    loadingMessage="O Estilista Digital está trabalhando..."
                />
            </main>
        </div>
    );
};

export default TryOnPanel;
