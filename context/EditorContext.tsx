
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

import React, {
  createContext,
  useContext,
  useState,
  useRef,
  useCallback,
  useEffect,
  ReactNode,
  useMemo,
} from 'react';
import {
  type FilterState,
  type ToolId,
  type TabId,
  type Toast,
  type DetectedObject,
  type TextToolState,
  type ProactiveSuggestionConfig,
  type TexturePreviewState,
  type PreviewState,
  type GifFrame,
  type Workflow,
  type SmartSearchResult,
  type VideoAspectRatio,
  type TransformType,
  type UploadProgressStatus,
  type PixelCrop,
  type Trend,
  type HistoryStateSnapshot,
  type EditorContextType,
} from '../types';
import * as db from '../utils/db';
import { useHistoryState } from '../hooks/useHistoryState';
import { usePanAndZoom } from '../hooks/usePanAndZoom';
import { useMaskCanvas } from '../hooks/useMaskCanvas';
import { buildFilterString, dataURLtoFile, getCroppedImg } from '../utils/imageUtils';
import * as geminiService from '../services/geminiService';
import { createMaskFromBoundingBox } from '../utils/imageProcessing';

export const DEFAULT_LOCAL_FILTERS: FilterState = {
  brightness: 100,
  contrast: 100,
  saturate: 100,
  grayscale: 0,
  sepia: 0,
  hueRotate: 0,
  invert: 0,
  blur: 0,
  curve: undefined,
};

const DEFAULT_TEXT_TOOL_STATE: TextToolState = {
  content: 'Texto de Exemplo',
  fontFamily: 'Impact',
  fontSize: 10,
  color: '#FFFFFF',
  align: 'center',
  bold: false,
  italic: false,
  position: { x: 50, y: 50 },
};


const EditorContext = createContext<EditorContextType | undefined>(undefined);

export const useEditor = () => {
    const context = useContext(EditorContext);
    if (context === undefined) {
      throw new Error('useEditor must be used within an EditorProvider');
    }
    return context;
};

export const EditorProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const [isEditingSessionActive, setIsEditingSessionActive] = useState(false);
    const [baseImageFile, setBaseImageFile] = useState<File | null>(null);
    const [uploadedFile, setUploadedFile] = useState<File | null>(null);
    const [isGif, setIsGif] = useState(false);
    const [gifFrames, setGifFrames] = useState<GifFrame[]>([]);
    const [isLeftPanelVisible, setIsLeftPanelVisible] = useState(true);
    const [isRightPanelVisible, setIsRightPanelVisible] = useState(true);
    const [theme, setTheme] = useState<'dark' | 'light'>('dark');
    const [isDownloadModalOpen, setIsDownloadModalOpen] = useState(false);
    const [isComparisonModalOpen, setIsComparisonModalOpen] = useState(false);
    const [isInlineComparisonActive, setIsInlineComparisonActive] = useState(false);
    const [isSaveWorkflowModalOpen, setIsSaveWorkflowModalOpen] = useState(false);
    const [activeTab, setActiveTabInternal] = useState<TabId | null>(null);
    const [toast, setToast] = useState<Toast | null>(null);
    const [activeTool, setActiveTool] = useState<ToolId | null>(null);
    const [isSmartSearching, setIsSmartSearching] = useState(false);
    const [smartSearchResult, setSmartSearchResult] = useState<SmartSearchResult | null>(null);
    const [hasRestoredSession, setHasRestoredSession] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [loadingMessage, setLoadingMessage] = useState<string | null>(null);
    const [crop, setCrop] = useState<PixelCrop>();
    const [completedCrop, setCompletedCrop] = useState<PixelCrop>();
    const [aspect, setAspect] = useState<number | undefined>();
    const [generatedVideoUrl, setGeneratedVideoUrl] = useState<string | null>(null);
    const [detectedObjects, setDetectedObjects] = useState<DetectedObject[] | null>(null);
    const [highlightedObject, setHighlightedObject] = useState<DetectedObject | null>(null);
    const [localFilters, setLocalFilters] = useState<FilterState>(DEFAULT_LOCAL_FILTERS);
    const [textToolState, setTextToolState] = useState<TextToolState>(DEFAULT_TEXT_TOOL_STATE);
    const [texturePreview, setTexturePreview] = useState<TexturePreviewState | null>(null);
    const [brushSize, setBrushSize] = useState(40);
    const [isEditCompleted, setIsEditCompleted] = useState(false);
    const [prompt, setPrompt] = useState('');
    const [histogram, setHistogram] = useState(null);
    const [initialPromptFromMetadata, setInitialPromptFromMetadata] = useState('');
    const [savedWorkflows, setSavedWorkflows] = useState<Workflow[]>([]);
    const [recentTools, setRecentTools] = useState<ToolId[]>([]);
    const [isBatchProcessing, setIsBatchProcessing] = useState(false);
    const [batchProgress, setBatchProgress] = useState<{ current: number; total: number; } | null>(null);
    const [proactiveSuggestion, setProactiveSuggestion] = useState<ProactiveSuggestionConfig | null>(null);
    const [showOnboarding, setShowOnboarding] = useState(false);
    const [backgroundColor, setBackgroundColor] = useState('#090A0F');
    const [uploadProgress, setUploadProgress] = useState<UploadProgressStatus | null>(null);
    const [currentFrameIndex, setCurrentFrameIndex] = useState(0);
    const [isBrushActive, setIsBrushActive] = useState(false);
    const [isPreviewLoading, setIsPreviewLoading] = useState(false);
    const [previewState, setPreviewState] = useState<PreviewState | null>(null);

    const imgRef = useRef<HTMLImageElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);

    const { history, historyIndex, currentState, canUndo, canRedo, commitChange, undo, redo, jumpToState, resetHistory, toolHistory } = useHistoryState(baseImageFile);
    const { zoom, setZoom, panOffset, isPanModeActive, setIsPanModeActive, handleWheel, handlePanStart, resetZoomAndPan, isCurrentlyPanning, handleTouchStart, handleTouchMove, handleTouchEnd } = usePanAndZoom();
    const { maskDataUrl, setMaskDataUrl, clearMask, startDrawing, stopDrawing, draw } = useMaskCanvas(canvasRef, brushSize);
    
    const setActiveTab = useCallback((tabId: TabId | null) => {
        setIsBrushActive(false); // Desativa o pincel ao trocar de ferramenta
        setActiveTabInternal(tabId);
    }, []);

    const setInitialImage = useCallback((file: File) => {
        setBaseImageFile(file);
        resetHistory(file);
    }, [resetHistory]);

    // Dummy functions
    const handleGoHome = () => setIsEditingSessionActive(false);
    const handleUploadNew = () => { console.log('handleUploadNew'); };
    const handleExplicitSave = () => { console.log('handleExplicitSave'); };
    const toggleTheme = () => setTheme(theme === 'dark' ? 'light' : 'dark');
    const handleDownload = (format: 'png' | 'jpeg', quality?: number) => { console.log('handleDownload', format, quality); };
    const handleFileSelect = (file: File) => { console.log('handleFileSelect', file); setUploadedFile(file)};
    
    const handleRemoveBackground = useCallback(async () => {
        const currentFile = currentState?.file;
        if (!currentFile) {
            setToast({ message: 'Selecione uma imagem para remover o fundo.', type: 'error' });
            return;
        }

        setIsLoading(true);
        setLoadingMessage('Removendo fundo...');
        setError(null);

        try {
            const resultDataUrl = await geminiService.removeBackground(currentFile, {}, setToast);
            const newFileName = `removedbg-${currentFile.name}`;
            const newFile = dataURLtoFile(resultDataUrl, newFileName);

            commitChange(newFile, 'removeBg');
            setToast({ message: 'Fundo removido com sucesso!', type: 'success' });
            setIsEditCompleted(true);
        } catch (e) {
            console.error("Falha ao remover fundo", e);
        } finally {
            setIsLoading(false);
            setLoadingMessage(null);
        }
    }, [currentState, commitChange, setToast, setIsLoading, setLoadingMessage, setError, setIsEditCompleted]);

    const handleApplyUpscale = useCallback(async (factor: number, preserveFace: boolean) => {
        const currentFile = currentState?.file;
        if (!currentFile) {
            setToast({ message: 'Selecione uma imagem para aumentar a resolução.', type: 'error' });
            return;
        }

        setIsLoading(true);
        setLoadingMessage(`Aumentando resolução em ${factor}x...`);
        setError(null);

        try {
            const resultDataUrl = await geminiService.upscaleImage(currentFile, factor, preserveFace, setToast);
            const newFileName = `upscaled-${factor}x-${currentFile.name}`;
            const newFile = dataURLtoFile(resultDataUrl, newFileName);

            commitChange(newFile, 'upscale', { factor, preserveFace });
            setToast({ message: `Resolução aumentada em ${factor}x com sucesso!`, type: 'success' });
            setIsEditCompleted(true);
        } catch (e) {
            console.error("Falha ao aumentar resolução", e);
        } finally {
            setIsLoading(false);
            setLoadingMessage(null);
        }
    }, [currentState, commitChange, setToast, setIsLoading, setLoadingMessage, setError, setIsEditCompleted]);

    const handleRelight = useCallback(async (prompt: string) => {
        const currentFile = currentState?.file;
        if (!currentFile) {
            setToast({ message: 'Selecione uma imagem para reacender.', type: 'error' });
            return;
        }

        setIsLoading(true);
        setLoadingMessage('Aplicando nova iluminação...');
        setError(null);

        try {
            const resultDataUrl = await geminiService.reacenderImage(currentFile, prompt, setToast);
            const newFileName = `relit-${currentFile.name}`;
            const newFile = dataURLtoFile(resultDataUrl, newFileName);

            commitChange(newFile, 'relight', { prompt });
            setToast({ message: 'Iluminação aplicada com sucesso!', type: 'success' });
            setIsEditCompleted(true);
        } catch (e) {
            console.error("Falha ao reacender imagem", e);
        } finally {
            setIsLoading(false);
            setLoadingMessage(null);
        }
    }, [currentState, commitChange, setToast, setIsLoading, setLoadingMessage, setError, setIsEditCompleted]);

    const handleApplyLowPoly = useCallback(async () => {
        const currentFile = currentState?.file;
        if (!currentFile) {
            setToast({ message: 'Selecione uma imagem para aplicar o estilo.', type: 'error' });
            return;
        }

        setIsLoading(true);
        setLoadingMessage('Aplicando estilo Low Poly...');
        setError(null);

        try {
            const resultDataUrl = await geminiService.generateLowPoly(currentFile, setToast);
            const newFileName = `lowpoly-${currentFile.name}`;
            const newFile = dataURLtoFile(resultDataUrl, newFileName);

            commitChange(newFile, 'lowPoly');
            setToast({ message: 'Estilo Low Poly aplicado com sucesso!', type: 'success' });
            setIsEditCompleted(true);
        } catch (e) {
            console.error("Falha ao aplicar estilo Low Poly", e);
        } finally {
            setIsLoading(false);
            setLoadingMessage(null);
        }
    }, [currentState, commitChange, setToast, setIsLoading, setLoadingMessage, setError, setIsEditCompleted]);

    const handleApplyDustAndScratch = useCallback(async () => {
        const currentFile = currentState?.file;
        if (!currentFile) {
            setToast({ message: 'Selecione uma imagem para aplicar o efeito.', type: 'error' });
            return;
        }

        setIsLoading(true);
        setLoadingMessage('Aplicando efeito de poeira e arranhões...');
        setError(null);

        try {
            const resultDataUrl = await geminiService.applyDustAndScratches(currentFile, setToast);
            const newFileName = `vintage-${currentFile.name}`;
            const newFile = dataURLtoFile(resultDataUrl, newFileName);

            commitChange(newFile, 'dustAndScratches');
            setToast({ message: 'Efeito vintage aplicado com sucesso!', type: 'success' });
            setIsEditCompleted(true);
        } catch (e) {
            console.error("Falha ao aplicar efeito vintage", e);
        } finally {
            setIsLoading(false);
            setLoadingMessage(null);
        }
    }, [currentState, commitChange, setToast, setIsLoading, setLoadingMessage, setError, setIsEditCompleted]);

    const handleExtractArt = useCallback(async () => {
        const currentFile = currentState?.file;
        if (!currentFile) {
            setToast({ message: 'Selecione uma imagem para extrair a arte.', type: 'error' });
            return;
        }

        setIsLoading(true);
        setLoadingMessage('Extraindo arte de linha...');
        setError(null);

        try {
            const resultDataUrl = await geminiService.extractArt(currentFile, setToast);
            const newFileName = `lineart-${currentFile.name}`;
            const newFile = dataURLtoFile(resultDataUrl, newFileName);

            commitChange(newFile, 'extractArt');
            setToast({ message: 'Arte de linha extraída com sucesso!', type: 'success' });
            setIsEditCompleted(true);
        } catch (e) {
            console.error("Falha ao extrair arte", e);
        } finally {
            setIsLoading(false);
            setLoadingMessage(null);
        }
    }, [currentState, commitChange, setToast, setIsLoading, setLoadingMessage, setError, setIsEditCompleted]);
    
    const handleDenoise = useCallback(async () => {
        const currentFile = currentState?.file;
        if (!currentFile) {
            setToast({ message: 'Selecione uma imagem para remover o ruído.', type: 'error' });
            return;
        }

        setIsLoading(true);
        setLoadingMessage('Removendo ruído...');
        setError(null);

        try {
            const resultDataUrl = await geminiService.denoiseImage(currentFile, setToast);
            const newFileName = `denoised-${currentFile.name}`;
            const newFile = dataURLtoFile(resultDataUrl, newFileName);

            commitChange(newFile, 'denoise');
            setToast({ message: 'Ruído removido com sucesso!', type: 'success' });
            setIsEditCompleted(true);
        } catch (e) {
            console.error("Falha ao remover ruído", e);
        } finally {
            setIsLoading(false);
            setLoadingMessage(null);
        }
    }, [currentState, commitChange, setToast, setIsLoading, setLoadingMessage, setError, setIsEditCompleted]);

    const handleApplyFaceRecovery = useCallback(async () => {
        const currentFile = currentState?.file;
        if (!currentFile) {
            setToast({ message: 'Selecione uma imagem para recuperar rostos.', type: 'error' });
            return;
        }

        setIsLoading(true);
        setLoadingMessage('Recuperando detalhes faciais...');
        setError(null);

        try {
            const resultDataUrl = await geminiService.applyFaceRecovery(currentFile, setToast);
            const newFileName = `face-recovered-${currentFile.name}`;
            const newFile = dataURLtoFile(resultDataUrl, newFileName);

            commitChange(newFile, 'faceRecovery');
            setToast({ message: 'Rostos recuperados com sucesso!', type: 'success' });
            setIsEditCompleted(true);
        } catch (e) {
            console.error("Falha ao recuperar rostos", e);
        } finally {
            setIsLoading(false);
            setLoadingMessage(null);
        }
    }, [currentState, commitChange, setToast, setIsLoading, setLoadingMessage, setError, setIsEditCompleted]);

    const handleUnblurImage = useCallback(async (sharpenLevel: number, denoiseLevel: number, model: string) => {
        const currentFile = currentState?.file;
        if (!currentFile) {
            setToast({ message: 'Selecione uma imagem para remover o desfoque.', type: 'error' });
            return;
        }

        setIsLoading(true);
        setLoadingMessage('Removendo desfoque...');
        setError(null);

        try {
            const resultDataUrl = await geminiService.unblurImage(currentFile, sharpenLevel, denoiseLevel, model, setToast);
            const newFileName = `unblurred-${currentFile.name}`;
            const newFile = dataURLtoFile(resultDataUrl, newFileName);

            commitChange(newFile, 'unblur', { sharpenLevel, denoiseLevel, model });
            setToast({ message: 'Desfoque removido com sucesso!', type: 'success' });
            setIsEditCompleted(true);
        } catch (e) {
            console.error("Falha ao remover desfoque", e);
        } finally {
            setIsLoading(false);
            setLoadingMessage(null);
        }
    }, [currentState, commitChange, setToast, setIsLoading, setLoadingMessage, setError, setIsEditCompleted]);
    
    const handleApplySharpen = useCallback(async (intensity: number) => {
        const currentFile = currentState?.file;
        if (!currentFile) {
            setToast({ message: 'Selecione uma imagem para aplicar nitidez.', type: 'error' });
            return;
        }

        setIsLoading(true);
        setLoadingMessage('Aplicando nitidez...');
        setError(null);

        try {
            const resultDataUrl = await geminiService.unblurImage(currentFile, intensity, 0, 'soft-focus', setToast);
            const newFileName = `sharpened-${currentFile.name}`;
            const newFile = dataURLtoFile(resultDataUrl, newFileName);
            
            commitChange(newFile, 'sharpen', { intensity });
            setToast({ message: 'Nitidez aplicada com sucesso!', type: 'success' });
            setIsEditCompleted(true);
        } catch (e) {
            console.error("Falha ao aplicar nitidez", e);
        } finally {
            setIsLoading(false);
            setLoadingMessage(null);
        }
    }, [currentState, commitChange, setToast, setIsLoading, setLoadingMessage, setError, setIsEditCompleted]);

    const handleApplyStyle = useCallback(async (stylePrompt: string, applyToAll: boolean) => {
        const currentFile = currentState?.file;
        if (!currentFile) {
            setToast({ message: 'Selecione uma imagem para aplicar o estilo.', type: 'error' });
            return;
        }

        setIsLoading(true);
        setLoadingMessage('Aplicando estilo...');
        setError(null);

        try {
            // TODO: Handle GIF applyToAll logic
            const resultDataUrl = await geminiService.applyStyle(currentFile, stylePrompt, setToast);
            const newFileName = `styled-${currentFile.name}`;
            const newFile = dataURLtoFile(resultDataUrl, newFileName);

            commitChange(newFile, 'style', { stylePrompt });
            setToast({ message: 'Estilo aplicado com sucesso!', type: 'success' });
            setIsEditCompleted(true);

            // Clear the preview state after applying
            setPreviewState(null);
        } catch (e) {
            console.error("Falha ao aplicar estilo", e);
        } finally {
            setIsLoading(false);
            setLoadingMessage(null);
        }
    }, [currentState, commitChange, setToast, setIsLoading, setLoadingMessage, setError, setIsEditCompleted, setPreviewState]);

    const generateAIPreview = useCallback(async (trend: Trend, applyToAll: boolean) => {
        const currentFile = currentState?.file;
        if (!currentFile) {
            setToast({ message: 'Selecione uma imagem para aplicar um estilo.', type: 'error' });
            return;
        }
    
        setIsPreviewLoading(true);
        setPreviewState({ trend, applyToAll, url: '' }); // Set initial state to show loading
    
        try {
            const resultDataUrl = await geminiService.applyStyle(currentFile, trend.prompt, setToast);
            setPreviewState({ trend, applyToAll, url: resultDataUrl });
    
        } catch (e) {
            console.error("Falha ao gerar pré-visualização de estilo", e);
            setPreviewState(null); // Clear preview on error
            // Error toast is handled by the service layer
        } finally {
            setIsPreviewLoading(false);
        }
    }, [currentState, setToast, setIsPreviewLoading, setPreviewState]);

    const commitAIPreview = useCallback(() => {
        if (!previewState) return;
        handleApplyStyle(previewState.trend.prompt, previewState.applyToAll);
    }, [previewState, handleApplyStyle]);
    const handleDetectObjects = (prompt?: string) => { console.log('handleDetectObjects', prompt); };
    const handleAnalyzeImage = useCallback(async (question: string): Promise<string | undefined> => {
        const currentFile = currentState?.file;
        if (!currentFile) {
            setToast({ message: 'Selecione uma imagem para analisar.', type: 'error' });
            return undefined;
        }

        setIsLoading(true);
        setLoadingMessage('Analisando imagem...');
        setError(null);

        try {
            const result = await geminiService.analyzeImage(currentFile, question, setToast);
            return result;
        } catch (e) {
            console.error("Falha ao analisar a imagem", e);
            return undefined;
        } finally {
            setIsLoading(false);
            setLoadingMessage(null);
        }
    }, [currentState, setToast, setIsLoading, setLoadingMessage, setError]);
    const resetTextToolState = useCallback(() => setTextToolState(DEFAULT_TEXT_TOOL_STATE), []);
    const handleApplyCurve = (lut: number[]) => { console.log('handleApplyCurve', lut); };
    const addPromptToHistory = (prompt: string) => { console.log('addPromptToHistory', prompt); };
    const handleGenerateVideo = (prompt: string, aspectRatio: VideoAspectRatio) => { console.log('handleGenerateVideo', prompt, aspectRatio); };
    
    const handleRestorePhoto = useCallback(async (colorize: boolean) => {
        const currentFile = currentState?.file;
        if (!currentFile) {
            setToast({ message: 'Selecione uma imagem para restaurar.', type: 'error' });
            return;
        }
    
        setIsLoading(true);
        setLoadingMessage('Restaurando sua foto...');
        setError(null);
    
        try {
            const resultDataUrl = await geminiService.restorePhoto(currentFile, colorize, setToast);
            const newFileName = `restored-${currentFile.name}`;
            const newFile = dataURLtoFile(resultDataUrl, newFileName);
    
            commitChange(newFile, 'photoRestoration', { colorize });
            setToast({ message: 'Foto restaurada com sucesso!', type: 'success' });
            setIsEditCompleted(true);
        } catch (e) {
            console.error("Falha ao restaurar foto", e);
        } finally {
            setIsLoading(false);
            setLoadingMessage(null);
        }
    }, [currentState, commitChange, setToast, setIsLoading, setLoadingMessage, setError, setIsEditCompleted]);

    const resetLocalFilters = useCallback(() => setLocalFilters(DEFAULT_LOCAL_FILTERS), []);

    const handleApplyLocalAdjustments = useCallback(async (filtersToApply: FilterState) => {
        const currentFile = currentState?.file;
        if (!currentFile) {
            setToast({ message: 'Nenhuma imagem ativa para aplicar ajustes.', type: 'error' });
            return;
        }
    
        setIsLoading(true);
        setLoadingMessage('Aplicando ajustes...');
        
        const image = new Image();
        const objectUrl = URL.createObjectURL(currentFile);
    
        try {
            await new Promise<void>((resolve, reject) => {
                image.onload = () => resolve();
                image.onerror = (err) => reject(err);
                image.src = objectUrl;
            });
            
            const canvas = document.createElement('canvas');
            canvas.width = image.naturalWidth;
            canvas.height = image.naturalHeight;
            const ctx = canvas.getContext('2d');
            if (!ctx) throw new Error("Não foi possível obter o contexto do canvas");
            
            let finalDataUrl = '';
            
            if (maskDataUrl) {
                const maskImage = new Image();
                await new Promise<void>((r, j) => { maskImage.onload = () => r(); maskImage.onerror = j; maskImage.src = maskDataUrl; });
                
                // 1. Draw original image
                ctx.drawImage(image, 0, 0);
    
                // 2. Create a temporary canvas with the filtered image
                const tempCanvas = document.createElement('canvas');
                tempCanvas.width = canvas.width;
                tempCanvas.height = canvas.height;
                const tempCtx = tempCanvas.getContext('2d');
                if (!tempCtx) throw new Error("Could not get temp canvas context");
                tempCtx.filter = buildFilterString(filtersToApply);
                tempCtx.drawImage(image, 0, 0);
    
                // 3. Mask the filtered image
                tempCtx.globalCompositeOperation = 'destination-in';
                tempCtx.drawImage(maskImage, 0, 0, canvas.width, canvas.height);
    
                // 4. Draw the masked filtered image on top of the original
                ctx.drawImage(tempCanvas, 0, 0);
    
                finalDataUrl = canvas.toDataURL();
            } else {
                // Global adjustment
                ctx.filter = buildFilterString(filtersToApply);
                ctx.drawImage(image, 0, 0);
                finalDataUrl = canvas.toDataURL();
            }
    
            const newFile = dataURLtoFile(finalDataUrl, `adjusted-${currentFile.name}`);
            commitChange(newFile, maskDataUrl ? 'localAdjust' : 'adjust', { filters: filtersToApply });
            
            if (maskDataUrl) {
                clearMask();
            }
            resetLocalFilters();
    
        } catch (err) {
            console.error(err);
            const message = err instanceof Error ? err.message : 'Falha ao aplicar ajustes.';
            setToast({ message, type: 'error' });
        } finally {
            URL.revokeObjectURL(objectUrl);
            setIsLoading(false);
            setLoadingMessage(null);
        }
    }, [currentState, commitChange, setIsLoading, setLoadingMessage, setToast, buildFilterString, maskDataUrl, clearMask, resetLocalFilters]);
    
    const handleApplyAIAdjustment = (prompt: string, applyToAll: boolean) => { console.log('handleApplyAIAdjustment', prompt, applyToAll); };
    const handleApplyNewAspectRatio = () => { console.log('handleApplyNewAspectRatio'); };
    
    const handleEditTextWithPrompt = useCallback(async (prompt: string) => {
        const currentFile = currentState?.file;
        if (!currentFile) {
            setToast({ message: 'Selecione uma imagem para editar.', type: 'error' });
            return;
        }

        setIsLoading(true);
        setLoadingMessage('Aplicando edição mágica...');
        setError(null);

        try {
            const resultDataUrl = await geminiService.applyStyleToImage(currentFile, prompt, setToast);
            const newFileName = `textedit-${currentFile.name}`;
            const newFile = dataURLtoFile(resultDataUrl, newFileName);

            commitChange(newFile, 'aiTextEdit', { prompt });
            setToast({ message: 'Edição mágica aplicada com sucesso!', type: 'success' });
            setIsEditCompleted(true);
        } catch (e) {
            console.error("Falha na edição mágica por texto", e);
        } finally {
            setIsLoading(false);
            setLoadingMessage(null);
        }
    }, [currentState, commitChange, setToast, setIsLoading, setLoadingMessage, setError, setIsEditCompleted]);

    const addWorkflow = (workflow: Workflow) => { console.log('addWorkflow', workflow); };
    const executeWorkflow = (toolIds: ToolId[]) => { console.log('executeWorkflow', toolIds); };
    const handlePredefinedSearchAction = (action: { type: 'tool' | 'workflow'; payload: ToolId | ToolId[]; }) => { console.log('handlePredefinedSearchAction', action); };
    
    const handleAIPortrait = useCallback(async (style: string, personImages: File[], prompt: string) => {
        setIsLoading(true);
        setLoadingMessage('Gerando retrato IA...');
        setError(null);
        try {
            const resultDataUrl = await geminiService.generateAIPortrait(style, personImages, prompt, setToast);
            const newFileName = `ai-portrait-${personImages[0].name}`;
            const newFile = dataURLtoFile(resultDataUrl, newFileName);
    
            commitChange(newFile, 'aiPortraitStudio');
            setToast({ message: 'Retrato IA gerado com sucesso!', type: 'success' });
        } catch (e) {
            console.error("Falha ao gerar retrato IA", e);
        } finally {
            setIsLoading(false);
            setLoadingMessage(null);
        }
    }, [commitChange, setToast, setIsLoading, setLoadingMessage, setError]);
    const handleConfidentStudio = (imageFile: File, mainPrompt: string, negativePrompt: string) => { console.log('handleConfidentStudio', imageFile, mainPrompt, negativePrompt); };
    const handleFunkoPop = (mainImageFile: File, personImage: File | null, bgDescription: string, objectDescription: string, lightingDescription: string, funkoType: string, specialFinish: string) => { console.log('handleFunkoPop', mainImageFile, personImage, bgDescription, objectDescription, lightingDescription, funkoType, specialFinish); };
    const handleMagicMontage = async (mainImageFile: File, prompt: string, secondImageFile?: File) => { console.log('handleMagicMontage', mainImageFile, prompt, secondImageFile); };
    const handlePolaroid = (personFile: File, celebrityFile: File, negativePrompt: string) => { console.log('handlePolaroid', personFile, celebrityFile, negativePrompt); };
    const handleStyledPortrait = (personFile: File, styleFiles: File[], prompt: string, negativePrompt: string) => { console.log('handleStyledPortrait', personFile, styleFiles, prompt, negativePrompt); };
    const handleSuperheroFusion = useCallback(async (person: File, hero: File) => {
        setIsLoading(true);
        setLoadingMessage('Criando fusão de super-herói...');
        setError(null);
    
        try {
            const resultDataUrl = await geminiService.generateSuperheroFusion(person, hero, setToast);
            const newFileName = `fusion-${person.name}`;
            const newFile = dataURLtoFile(resultDataUrl, newFileName);
    
            commitChange(newFile, 'superheroFusion');
            setToast({ message: 'Fusão criada com sucesso!', type: 'success' });
            setIsEditCompleted(true);
        } catch (e) {
            console.error("Falha ao criar fusão de super-herói", e);
        } finally {
            setIsLoading(false);
            setLoadingMessage(null);
        }
    }, [commitChange, setToast, setIsLoading, setLoadingMessage, setError, setIsEditCompleted]);
    const handleVirtualTryOn = (personFile: File, clothingFile: File, shoeFile: File | undefined, scenePrompt: string, posePrompt: string, cameraLens: string, cameraAngle: string, lightingStyle: string, negativePrompt: string) => { console.log('handleVirtualTryOn', personFile, clothingFile, shoeFile, scenePrompt, posePrompt, cameraLens, cameraAngle, lightingStyle, negativePrompt); };
    const handleCreativeFusion = useCallback(async (compositionFile: File, styleFiles: File[]) => {
        setIsLoading(true);
        setLoadingMessage('Criando fusão criativa...');
        setError(null);
        try {
            const resultDataUrl = await geminiService.generateCreativeFusion(compositionFile, styleFiles, setToast);
            const newFileName = `creative-fusion-${compositionFile.name}`;
            const newFile = dataURLtoFile(resultDataUrl, newFileName);
    
            commitChange(newFile, 'styledPortrait');
            setToast({ message: 'Fusão criativa aplicada!', type: 'success' });
            setActiveTool(null);
        } catch (e) {
            console.error("Falha ao criar fusão criativa", e);
        } finally {
            setIsLoading(false);
            setLoadingMessage(null);
        }
    }, [commitChange, setToast, setIsLoading, setLoadingMessage, setError, setActiveTool]);
    const handleDoubleExposure = async (portraitFile: File, landscapeFile: File) => { console.log('handleDoubleExposure', portraitFile, landscapeFile); return ''; };
    const handleBatchProcess = (files: File[], toolIds: ToolId[], onProgress: (results: { original: string; processed: string; }[]) => void) => { console.log('handleBatchProcess', files, toolIds, onProgress); };
    
    const handleEnhanceResolutionAndSharpness = useCallback(async (factor: number, intensity: number, preserveFace: boolean) => {
        const currentFile = currentState?.file;
        if (!currentFile) {
            setToast({ message: 'Selecione uma imagem para aplicar a super resolução.', type: 'error' });
            return;
        }
    
        setIsLoading(true);
        setError(null);
    
        try {
            setLoadingMessage(`Aumentando resolução em ${factor}x...`);
            const upscaledDataUrl = await geminiService.upscaleImage(currentFile, factor, preserveFace, setToast);
            const upscaledFile = dataURLtoFile(upscaledDataUrl, `superres-upscaled-${currentFile.name}`);
    
            setLoadingMessage(`Aplicando nitidez generativa...`);
            const sharpenedDataUrl = await geminiService.unblurImage(upscaledFile, intensity, 0, 'soft-focus', setToast);
            const finalFile = dataURLtoFile(sharpenedDataUrl, `superres-final-${currentFile.name}`);
            
            commitChange(finalFile, 'superResolution', { factor, intensity, preserveFace });
            setToast({ message: 'Super resolução aplicada com sucesso!', type: 'success' });
            setIsEditCompleted(true);
    
        } catch (e) {
            console.error("Falha ao aplicar super resolução", e);
        } finally {
            setIsLoading(false);
            setLoadingMessage(null);
        }
    }, [currentState, commitChange, setToast, setIsLoading, setLoadingMessage, setError, setIsEditCompleted]);

    const handleApplyTexture = useCallback(async () => {
        const currentFile = currentState?.file;
        if (!currentFile || !texturePreview) {
            setToast({ message: 'Selecione uma imagem e uma textura para aplicar.', type: 'error' });
            return;
        }
    
        setIsLoading(true);
        setLoadingMessage('Aplicando textura...');
    
        try {
            const textureUrl = texturePreview.url;
            const { opacity, blendMode } = texturePreview;
    
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            if (!ctx) {
                throw new Error('Não foi possível obter o contexto do canvas.');
            }
    
            const baseImg = new Image();
            const textureImg = new Image();
            textureImg.crossOrigin = 'anonymous';
    
            const baseObjectUrl = URL.createObjectURL(currentFile);
    
            await new Promise<void>((resolve, reject) => {
                baseImg.onload = () => {
                    textureImg.onload = () => {
                        canvas.width = baseImg.naturalWidth;
                        canvas.height = baseImg.naturalHeight;
                        ctx.drawImage(baseImg, 0, 0);
                        ctx.globalCompositeOperation = blendMode;
                        ctx.globalAlpha = opacity;
                        ctx.drawImage(textureImg, 0, 0, canvas.width, canvas.height);
                        ctx.globalCompositeOperation = 'source-over';
                        ctx.globalAlpha = 1.0;
                        resolve();
                    };
                    textureImg.onerror = (err) => reject(new Error('Falha ao carregar imagem de textura.'));
                    textureImg.src = textureUrl;
                };
                baseImg.onerror = (err) => reject(new Error('Falha ao carregar imagem base.'));
                baseImg.src = baseObjectUrl;
            });
            
            URL.revokeObjectURL(baseObjectUrl);
    
            const dataUrl = canvas.toDataURL();
            const newFile = dataURLtoFile(dataUrl, `textured-${currentFile.name}`);
            
            commitChange(newFile, 'texture', { texture: texturePreview });
            setToast({ message: 'Textura aplicada com sucesso!', type: 'success' });
            setTexturePreview(null);
            setIsEditCompleted(true);
    
        } catch (e) {
            const errorMessage = e instanceof Error ? e.message : 'Ocorreu um erro ao aplicar a textura.';
            console.error('Falha ao aplicar textura', e);
            setToast({ message: errorMessage, type: 'error' });
        } finally {
            setIsLoading(false);
            setLoadingMessage(null);
        }
    }, [currentState, texturePreview, commitChange, setToast, setIsLoading, setLoadingMessage, setTexturePreview, setIsEditCompleted]);

    const confirmAndStartEditing = () => { setUploadedFile(null); setInitialImage(uploadedFile!); setIsEditingSessionActive(true); };
    const cancelPreview = () => { setUploadedFile(null); };
    
    const handleApplyText = useCallback(async () => {
        const currentFile = currentState?.file;
        if (!currentFile) {
            setToast({ message: 'Selecione uma imagem para aplicar o texto.', type: 'error' });
            return;
        }
        
        setIsLoading(true);
        setLoadingMessage('Aplicando texto...');
        
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        if (!ctx) {
            setToast({ message: 'Erro ao criar canvas para texto.', type: 'error' });
            setIsLoading(false);
            return;
        }
    
        const img = new Image();
        const objectUrl = URL.createObjectURL(currentFile);
        img.onload = () => {
            canvas.width = img.naturalWidth;
            canvas.height = img.naturalHeight;
            ctx.drawImage(img, 0, 0);
            
            const { content, fontFamily, fontSize, color, align, bold, italic, position } = textToolState;
            const pixelFontSize = (fontSize / 100) * img.naturalWidth;
            ctx.font = `${italic ? 'italic' : ''} ${bold ? 'bold' : ''} ${pixelFontSize}px ${fontFamily}`;
            ctx.textAlign = align;
            ctx.fillStyle = color;
            
            const lines = content.split('\n');
            const lineHeight = pixelFontSize * 1.2;
    
            const canvasX = (position.x / 100) * img.naturalWidth;
            const y = (position.y / 100) * img.naturalHeight - ((lines.length -1) * lineHeight / 2); // Center vertically
    
            ctx.strokeStyle = '#000000';
            ctx.lineWidth = Math.max(1, pixelFontSize * 0.05);
    
            lines.forEach((line, index) => {
                const currentY = y + (index * lineHeight);
                ctx.strokeText(line || ' ', canvasX, currentY);
                ctx.fillText(line || ' ', canvasX, currentY);
            });
    
            const dataUrl = canvas.toDataURL();
            const newFile = dataURLtoFile(dataUrl, `text-${currentFile.name}`);
            
            commitChange(newFile, 'text', { textState: textToolState });
            setToast({ message: 'Texto aplicado com sucesso!', type: 'success' });
            setIsEditCompleted(true);
            resetTextToolState();
            setIsLoading(false);
            setActiveTab('adjust');
            URL.revokeObjectURL(objectUrl);
        };
        img.onerror = () => {
            setToast({ message: 'Erro ao carregar imagem para aplicar texto.', type: 'error' });
            setIsLoading(false);
            URL.revokeObjectURL(objectUrl);
        }
        img.src = objectUrl;
    
    }, [currentState, textToolState, commitChange, setToast, setIsLoading, setLoadingMessage, resetTextToolState, setIsEditCompleted, setActiveTab]);
    
    const handleApplySepiaFilter = () => { console.log('handleApplySepiaFilter not implemented'); };
    const handleSelectObject = (object: DetectedObject) => {
        if (!imgRef.current) return;
        const mask = createMaskFromBoundingBox(object.box, imgRef.current.naturalWidth, imgRef.current.naturalHeight);
        setMaskDataUrl(mask);
        setHighlightedObject(object);
    };

    const handleGenerativeEdit = useCallback(async () => {
        const currentFile = currentState?.file;
        if (!currentFile) {
            setToast({ message: 'Selecione uma imagem para editar.', type: 'error' });
            return;
        }
        if (!maskDataUrl) {
            setToast({ message: 'Por favor, selecione uma área na imagem para editar.', type: 'error' });
            return;
        }
        if (!prompt.trim()){
            setToast({ message: 'Por favor, descreva a edição que deseja fazer.', type: 'error' });
            return;
        }
        
        setIsLoading(true);
        setLoadingMessage('Gerando edição...');
        setError(null);
        
        try {
            const maskFile = dataURLtoFile(maskDataUrl, 'mask.png');
            const resultDataUrl = await geminiService.generativeEdit(currentFile, prompt, 'fill', { maskImage: maskFile }, setToast);
            const newFileName = `genedit-${currentFile.name}`;
            const newFile = dataURLtoFile(resultDataUrl, newFileName);
    
            commitChange(newFile, 'generativeEdit', { prompt });
            setToast({ message: 'Edição generativa aplicada com sucesso!', type: 'success' });
            setIsEditCompleted(true);
            clearMask();
            setPrompt('');
        } catch (e) {
            console.error("Falha na edição generativa", e);
        } finally {
            setIsLoading(false);
            setLoadingMessage(null);
        }
    }, [currentState, maskDataUrl, prompt, commitChange, setToast, setIsLoading, setLoadingMessage, setError, setIsEditCompleted, clearMask, setPrompt]);
    
    const handleObjectRemove = useCallback(async () => {
        const currentFile = currentState?.file;
        if (!currentFile) {
            setToast({ message: 'Selecione uma imagem para editar.', type: 'error' });
            return;
        }
        if (!maskDataUrl) {
            setToast({ message: 'Por favor, selecione uma área na imagem para remover.', type: 'error' });
            return;
        }

        setIsLoading(true);
        setLoadingMessage('Removendo objeto...');
        setError(null);
        
        try {
            const maskFile = dataURLtoFile(maskDataUrl, 'mask.png');
            const resultDataUrl = await geminiService.generativeEdit(currentFile, '', 'remove', { maskImage: maskFile }, setToast);
            const newFileName = `removed-${currentFile.name}`;
            const newFile = dataURLtoFile(resultDataUrl, newFileName);

            commitChange(newFile, 'objectRemover');
            setToast({ message: 'Objeto removido com sucesso!', type: 'success' });
            setIsEditCompleted(true);
            clearMask();
        } catch (e) {
            console.error("Falha na remoção de objeto", e);
        } finally {
            setIsLoading(false);
            setLoadingMessage(null);
        }
    }, [currentState, maskDataUrl, commitChange, setToast, setIsLoading, setLoadingMessage, setError, setIsEditCompleted, clearMask]);


    const handleDetectFaces = useCallback(async () => {
        const currentFile = currentState?.file;
        if (!currentFile) {
            setToast({ message: 'Selecione uma imagem para detectar rostos.', type: 'error' });
            return;
        }
        
        setIsLoading(true);
        setLoadingMessage('Detectando rostos...');
        setError(null);
        setDetectedObjects(null);

        try {
            const faces = await geminiService.detectFaces(currentFile);
            if (faces.length === 0) {
                setToast({ message: 'Nenhum rosto foi detectado na imagem.', type: 'info' });
            }
            setDetectedObjects(faces);
        } catch (e) {
            console.error("Falha ao detectar rostos.", e);
            const message = e instanceof Error ? e.message : "Ocorreu um erro desconhecido.";
            setToast({ message: `Erro na detecção: ${message}`, type: 'error' });
        } finally {
            setIsLoading(false);
            setLoadingMessage(null);
        }
    }, [currentState, setToast, setIsLoading, setLoadingMessage, setError]);
    
    const handleFaceSwap = useCallback(async (sourceImageFile: File, target: DetectedObject | File, prompt: string, negativePrompt: string): Promise<string | undefined> => {
        const currentFile = currentState?.file;
        if (!currentFile || !imgRef.current) {
            setToast({ message: 'Selecione uma imagem válida para a troca de rosto.', type: 'error' });
            return undefined;
        }
        
        setIsLoading(true);
        setLoadingMessage('Realizando troca de rosto...');
        setError(null);

        try {
            let maskFile: File;

            if (target instanceof File) {
                maskFile = target;
            } else {
                const maskDataUrl = createMaskFromBoundingBox(target.box, imgRef.current.naturalWidth, imgRef.current.naturalHeight);
                maskFile = dataURLtoFile(maskDataUrl, 'face-mask.png');
            }

            const resultDataUrl = await geminiService.faceSwap(currentFile, sourceImageFile, prompt, negativePrompt, setToast, maskFile);
            return resultDataUrl;

        } catch (e) {
            console.error("Falha ao aplicar a troca de rosto.", e);
            const message = e instanceof Error ? e.message : "Ocorreu um erro desconhecido durante a troca de rostos.";
            setToast({ message: `Erro na troca de rostos: ${message}`, type: 'error' });
            return undefined;
        } finally {
            setIsLoading(false);
            setLoadingMessage(null);
        }
    }, [currentState, imgRef, setToast, setIsLoading, setLoadingMessage, setError]);

    const handleApplyCrop = useCallback(async () => {
      if (!completedCrop || !imgRef.current) {
          setToast({ message: 'Por favor, selecione uma área para cortar.', type: 'error' });
          return;
      }
      const currentFile = currentState?.file;
      if (!currentFile) {
        setToast({ message: 'Nenhuma imagem ativa para aplicar o corte.', type: 'error' });
        return;
      }
  
      setIsLoading(true);
      setLoadingMessage('Cortando imagem...');
  
      try {
          const croppedImageUrl = await getCroppedImg(imgRef.current, completedCrop);
          const newFileName = `cropped-${currentFile.name || 'image'}.png`;
          const newFile = dataURLtoFile(croppedImageUrl, newFileName);
          
          commitChange(newFile, 'crop', { crop: completedCrop });
  
          setCrop(undefined);
          setCompletedCrop(undefined);
          setToast({ message: 'Imagem cortada com sucesso!', type: 'success' });
          setIsEditCompleted(true);
  
      } catch (e) {
          console.error('Falha ao cortar imagem', e);
          setToast({ message: 'Ocorreu um erro ao cortar a imagem.', type: 'error' });
      } finally {
          setIsLoading(false);
          setLoadingMessage(null);
      }
    }, [completedCrop, imgRef, currentState, commitChange, setToast, setIsLoading, setLoadingMessage, setCrop, setCompletedCrop, setIsEditCompleted]);

    const handleMagicPrompt = (prompt: string) => { console.log('handleMagicPrompt', prompt); };
    const handleSmartSearch = useCallback(async (prompt: string) => {
        if (!baseImageFile && !prompt.toLowerCase().includes('gerar imagem')) {
            setToast({ message: 'Por favor, carregue uma imagem antes de usar a busca inteligente.', type: 'info' });
            return;
        }

        setIsSmartSearching(true);
        setSmartSearchResult(null);
        setError(null);
        
        try {
            const result = await geminiService.suggestToolFromPrompt(prompt);
            
            if (result) {
                const { tool, args } = result;
                
                if (tool.isEditingTool) {
                    setIsEditingSessionActive(true);
                    
                    setTimeout(() => {
                        setActiveTab(tool.id as TabId);
                        
                        switch(tool.id) {
                            case 'photoRestoration':
                                const colorize = args.colorize === false ? false : true;
                                handleRestorePhoto(colorize);
                                break;
                            case 'removeBg':
                                handleRemoveBackground();
                                break;
                            case 'style':
                                if(args.stylePrompt) {
                                    handleApplyStyle(args.stylePrompt as string, true);
                                } else {
                                    setToast({ message: `Abri a ferramenta '${tool.name}'. Use as opções para aplicar um estilo.`, type: 'info' });
                                }
                                break;
                            case 'upscale':
                                const factor = (args.factor as number) || 4;
                                handleApplyUpscale(factor, true);
                                break;
                            case 'objectRemover':
                            case 'generativeEdit':
                                if(args.prompt) {
                                    setPrompt(args.prompt as string);
                                }
                                setToast({ message: `Abri a ferramenta '${tool.name}'. Pinte a área que deseja alterar.`, type: 'info' });
                                break;
                            default:
                                setToast({ message: `Abri a ferramenta '${tool.name}' para você.`, type: 'info' });
                        }
                    }, 200);

                } else {
                    setActiveTool(tool.id);
                }

            } else {
                setToast({ message: 'Nenhuma ferramenta correspondente encontrada. Tente reformular sua solicitação.', type: 'info' });
            }
        } catch(e) {
            const errorMessage = e instanceof Error ? e.message : 'Ocorreu um erro desconhecido.';
            setError(`Falha na busca inteligente: ${errorMessage}`);
            setToast({ message: `Falha na busca inteligente: ${errorMessage}`, type: 'error'});
        } finally {
            setIsSmartSearching(false);
        }
    }, [ baseImageFile, setToast, setIsSmartSearching, setSmartSearchResult, setError, setIsEditingSessionActive, setActiveTab, handleRestorePhoto, handleRemoveBackground, handleApplyStyle, handleApplyUpscale, setPrompt, setActiveTool ]);

    const handleTransform = useCallback(async (transformType: TransformType) => {
        const currentFile = currentState?.file;
        if (!currentFile) {
            setToast({ message: 'Selecione uma imagem para transformar.', type: 'error' });
            return;
        }

        setIsLoading(true);
        setLoadingMessage('Aplicando transformação...');

        try {
            const transformImage = (file: File, transform: TransformType): Promise<string> => {
                return new Promise((resolve, reject) => {
                    const img = new Image();
                    const objectUrl = URL.createObjectURL(file);
                    img.onload = () => {
                        const canvas = document.createElement('canvas');
                        const ctx = canvas.getContext('2d');
                        if (!ctx) {
                            URL.revokeObjectURL(objectUrl);
                            return reject('No canvas context');
                        }

                        if (transform === 'rotate-left' || transform === 'rotate-right') {
                            canvas.width = img.height;
                            canvas.height = img.width;
                        } else {
                            canvas.width = img.width;
                            canvas.height = img.height;
                        }

                        if (transform === 'rotate-left') {
                            ctx.rotate(-90 * Math.PI / 180);
                            ctx.translate(-img.width, 0);
                        } else if (transform === 'rotate-right') {
                            ctx.rotate(90 * Math.PI / 180);
                            ctx.translate(0, -img.height);
                        } else if (transform === 'flip-h') {
                            ctx.translate(img.width, 0);
                            ctx.scale(-1, 1);
                        } else if (transform === 'flip-v') {
                            ctx.translate(0, img.height);
                            ctx.scale(1, -1);
                        }
                        
                        ctx.drawImage(img, 0, 0);
                        resolve(canvas.toDataURL());
                        URL.revokeObjectURL(objectUrl);
                    };
                    img.onerror = (err) => {
                        URL.revokeObjectURL(objectUrl);
                        reject(err);
                    };
                    img.src = objectUrl;
                });
            };

            const transformedDataUrl = await transformImage(currentFile, transformType);
            const newFileName = `transformed-${currentFile.name}`;
            const newFile = dataURLtoFile(transformedDataUrl, newFileName);
            
            commitChange(newFile, 'crop', { transform: transformType });
            setToast({ message: 'Transformação aplicada!', type: 'success' });

        } catch (e) {
            console.error('Falha ao transformar imagem', e);
            setToast({ message: 'Erro ao aplicar transformação.', type: 'error' });
        } finally {
            setIsLoading(false);
            setLoadingMessage(null);
        }
    }, [currentState, commitChange, setToast, setIsLoading, setLoadingMessage]);
    
    const currentImageUrl = useMemo(() => {
        if (currentState?.file) {
            return URL.createObjectURL(currentState.file);
        }
        return null;
    }, [currentState]);

    const originalImageUrl = useMemo(() => {
        if (history[0]?.file) {
          return URL.createObjectURL(history[0].file);
        }
        return null;
      }, [history]);
    
      const hasLocalAdjustments = useMemo(() => {
        return JSON.stringify(localFilters) !== JSON.stringify(DEFAULT_LOCAL_FILTERS);
      }, [localFilters]);

    const value: EditorContextType = {
        isEditingSessionActive, setIsEditingSessionActive, baseImageFile, setInitialImage, uploadedFile, isGif, gifFrames, handleGoHome, handleUploadNew, handleExplicitSave, isLeftPanelVisible, setIsLeftPanelVisible, isRightPanelVisible, setIsRightPanelVisible, theme, toggleTheme, undo, redo, canUndo, canRedo, setIsDownloadModalOpen, isDownloadModalOpen, handleDownload, toolHistory, zoom, setZoom, isPanModeActive, setIsPanModeActive, resetZoomAndPan, currentImageUrl, originalImageUrl, jumpToState, setIsComparisonModalOpen, isComparisonModalOpen, isInlineComparisonActive, setIsInlineComparisonActive, setIsSaveWorkflowModalOpen, isSaveWorkflowModalOpen, activeTab, setActiveTab, toast, setToast, activeTool, setActiveTool, handleSmartSearch, isSmartSearching, smartSearchResult, setSmartSearchResult, handleFileSelect, hasRestoredSession, isLoading, error, setError, setIsLoading, setLoadingMessage, loadingMessage, imgRef, canvasRef, crop, setCrop, completedCrop, setCompletedCrop, aspect, setAspect, startDrawing, stopDrawing, draw, generatedVideoUrl, detectedObjects, setDetectedObjects, highlightedObject, setHighlightedObject, handleSelectObject, localFilters, setLocalFilters, hasLocalAdjustments, buildFilterString, textToolState, setTextToolState, texturePreview, brushSize, setBrushSize, isEditCompleted, setIsEditCompleted, handleApplyCrop, handleTransform, handleRemoveBackground, handleApplyUpscale, handleRelight, handleApplyLowPoly, handleApplyDustAndScratch, handleExtractArt, handleDenoise, handleApplyFaceRecovery, handleUnblurImage, handleApplySharpen, handleApplyStyle, generateAIPreview, isPreviewLoading, previewState, setPreviewState, commitAIPreview, handleGenerativeEdit, prompt, setPrompt, clearMask, maskDataUrl, handleDetectObjects, handleDetectFaces, handleAnalyzeImage, handleApplyText, resetTextToolState, histogram, handleApplyCurve, addPromptToHistory, initialPromptFromMetadata, handleFaceSwap, handleGenerateVideo, handleMagicPrompt, handleApplyLocalAdjustments, resetLocalFilters, handleApplyAIAdjustment, handleApplyNewAspectRatio, handleEditTextWithPrompt, addWorkflow, executeWorkflow, savedWorkflows, recentTools, handlePredefinedSearchAction, handleAIPortrait, handleConfidentStudio, handleFunkoPop, handleMagicMontage, handlePolaroid, handleStyledPortrait, handleSuperheroFusion, handleVirtualTryOn, handleCreativeFusion, handleDoubleExposure, handleBatchProcess, isBatchProcessing, batchProgress, proactiveSuggestion, setProactiveSuggestion, commitChange, handleApplyTexture, setTexturePreview, showOnboarding, setShowOnboarding, backgroundColor, confirmAndStartEditing, cancelPreview, uploadProgress, currentFrameIndex, setCurrentFrameIndex, isCurrentlyPanning, history, historyIndex, panOffset, handleWheel, handlePanStart, handleTouchStart, handleTouchMove, handleTouchEnd, handleEnhanceResolutionAndSharpness, handleObjectRemove, handleRestorePhoto, handleApplySepiaFilter, isBrushActive, setIsBrushActive,
        currentState // Include currentState in context value
    };

    return <EditorContext.Provider value={value}>{children}</EditorContext.Provider>;
};
