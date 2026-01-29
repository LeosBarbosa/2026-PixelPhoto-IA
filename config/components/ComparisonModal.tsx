
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import React, { useState } from 'react';
import LazyIcon from './LazyIcon';
import ComparisonSlider from './ComparisonSlider';

interface ComparisonModalProps {
  isOpen: boolean;
  onClose: () => void;
  beforeImage: string;
  afterImage: string;
}

const ComparisonModal: React.FC<ComparisonModalProps> = ({ isOpen, onClose, beforeImage, afterImage }) => {
  const [mode, setMode] = useState<'slider' | 'opacity'>('slider');
  const [opacity, setOpacity] = useState(50);
  
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-md flex items-center justify-center p-4 animate-fade-in" onClick={onClose}>
      <div 
        className="w-full h-full max-w-7xl max-h-[90vh] bg-gray-800 rounded-2xl shadow-2xl relative flex flex-col overflow-hidden border border-gray-700"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex-shrink-0 flex items-center justify-between p-4 border-b border-gray-700 bg-gray-900/50">
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <LazyIcon name="CompareArrowsIcon" className="w-5 h-5 text-blue-400" />
            Comparar Antes e Depois
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-white transition-colors bg-gray-700/50 hover:bg-gray-600/50 p-1 rounded-full" aria-label="Fechar comparação">
            <LazyIcon name="CloseIcon" className="w-6 h-6" />
          </button>
        </div>
        
        <div className="flex-grow relative overflow-hidden flex items-center justify-center p-4 bg-black/20">
          <ComparisonSlider 
            originalSrc={beforeImage} 
            modifiedSrc={afterImage}
            mode={mode}
            opacity={opacity}
          />
        </div>

        <div className="flex-shrink-0 flex flex-col sm:flex-row items-center justify-center gap-4 p-4 border-t border-gray-700 bg-gray-900/50">
          <div className="flex items-center gap-3">
            <span className="text-sm font-semibold text-gray-300">Modo de Visualização:</span>
            <div className="flex bg-gray-900 border border-gray-600 rounded-lg p-1">
              <button 
                onClick={() => setMode('slider')} 
                className={`flex items-center gap-2 px-3 py-1.5 text-sm rounded-md transition-all ${mode === 'slider' ? 'bg-blue-600 text-white shadow-md' : 'text-gray-400 hover:text-white hover:bg-gray-700/50'}`}
              >
                <LazyIcon name="SplitScreenIcon" className="w-4 h-4" />
                Divisor
              </button>
              <button 
                onClick={() => setMode('opacity')} 
                className={`flex items-center gap-2 px-3 py-1.5 text-sm rounded-md transition-all ${mode === 'opacity' ? 'bg-blue-600 text-white shadow-md' : 'text-gray-400 hover:text-white hover:bg-gray-700/50'}`}
              >
                <LazyIcon name="EyeIcon" className="w-4 h-4" />
                Sobreposição
              </button>
            </div>
          </div>

          {mode === 'opacity' && (
            <div className="flex items-center gap-3 text-white w-full sm:w-64 animate-fade-in bg-gray-800/50 p-2 rounded-lg border border-gray-700">
                <LazyIcon name="SunIcon" className="w-4 h-4 text-gray-400"/>
                <input
                    type="range"
                    min="0"
                    max="100"
                    value={opacity}
                    onChange={(e) => setOpacity(Number(e.target.value))}
                    className="w-full h-1 bg-gray-600 rounded-lg appearance-none cursor-pointer"
                    aria-label="Opacidade da imagem modificada"
                />
                <span className="font-mono text-xs w-8 text-right text-gray-300">{opacity}%</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ComparisonModal;
