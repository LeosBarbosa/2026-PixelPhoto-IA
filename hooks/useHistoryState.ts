/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

import { useState, useCallback } from 'react';
import { type ToolId, type ToolHistoryItem } from '../types';

const MAX_HISTORY_SIZE = 50;

export interface HistoryStateSnapshot {
    file: File;
    toolHistory: ToolHistoryItem[];
}

export const useHistoryState = (initialFile: File | null) => {
    const createInitialState = (file: File): HistoryStateSnapshot => ({
        file,
        toolHistory: [],
    });

    const initialHistory = initialFile ? [createInitialState(initialFile)] : [];
    const [history, setHistory] = useState<HistoryStateSnapshot[]>(initialHistory);
    const [historyIndex, setHistoryIndex] = useState<number>(initialFile ? 0 : -1);

    const canUndo = historyIndex > 0;
    const canRedo = historyIndex < history.length - 1;
    const currentState = history[historyIndex];
    const toolHistory = currentState?.toolHistory || [];

    const commitChange = useCallback((file: File, toolId: ToolId, params?: any) => {
        const currentToolHistory = currentState?.toolHistory || [];
        const newToolHistory: ToolHistoryItem[] = [...currentToolHistory, { toolId, params }];
        const newState: HistoryStateSnapshot = { file, toolHistory: newToolHistory };
        
        const newHistory = history.slice(0, historyIndex + 1);
        newHistory.push(newState);
        
        if (newHistory.length > MAX_HISTORY_SIZE) {
            newHistory.shift();
            setHistory(newHistory);
            setHistoryIndex(newHistory.length - 1);
        } else {
            setHistory(newHistory);
            setHistoryIndex(historyIndex + 1);
        }
    }, [history, historyIndex, currentState]);
    
    const undo = useCallback(() => {
        if (canUndo) {
            setHistoryIndex(historyIndex - 1);
        }
    }, [canUndo, historyIndex]);

    const redo = useCallback(() => {
        if (canRedo) {
            setHistoryIndex(historyIndex + 1);
        }
    }, [canRedo, historyIndex]);
    
    const jumpToState = useCallback((index: number) => {
        if (index >= 0 && index < history.length) {
            setHistoryIndex(index);
        }
    }, [history.length]);

    const resetHistory = useCallback((file?: File) => {
        if (file) {
            const initialState = createInitialState(file);
            setHistory([initialState]);
            setHistoryIndex(0);
        } else {
            setHistory([]);
            setHistoryIndex(-1);
        }
    }, []);

    return {
        history,
        historyIndex,
        currentState,
        canUndo,
        canRedo,
        commitChange,
        undo,
        redo,
        jumpToState,
        resetHistory,
        toolHistory,
    };
};