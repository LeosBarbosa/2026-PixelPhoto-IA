
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

import React, { useState, useRef, useCallback } from 'react';
import LazyIcon from './LazyIcon';

interface ComparisonSliderProps {
  originalSrc: string;
  modifiedSrc: string;
  filterStyle?: string;
  mode?: 'slider' | 'opacity';
  opacity?: number; // 0-100
}

const ComparisonSlider: React.FC<ComparisonSliderProps> = ({ originalSrc, modifiedSrc, filterStyle, mode = 'slider', opacity = 50 }) => {
  const [sliderPosition, setSliderPosition] = useState(50);
  const containerRef = useRef<HTMLDivElement>(null);
  const isDragging = useRef(false);

  const handleMove = useCallback((clientX: number) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const x = Math.max(0, Math.min(clientX - rect.left, rect.width));
    const percent = (x / rect.width) * 100;
    setSliderPosition(percent);
  }, []);

  const handleInteractionMove = useCallback((e: MouseEvent | TouchEvent) => {
      if (!isDragging.current) return;
      let clientX: number;
      if ('touches' in e) {
          if (!e.touches || e.touches.length === 0) return;
          clientX = e.touches[0].clientX;
      } else {
          clientX = e.clientX;
      }
      handleMove(clientX);
  }, [handleMove]);

  const handleInteractionEnd = useCallback(() => {
    if (!isDragging.current) return;
    isDragging.current = false;
    document.body.style.cursor = '';
    window.removeEventListener('mousemove', handleInteractionMove);
    window.removeEventListener('mouseup', handleInteractionEnd);
    window.removeEventListener('touchmove', handleInteractionMove);
    window.removeEventListener('touchend', handleInteractionEnd);
  }, [handleInteractionMove]);

  const handleInteractionStart = useCallback((clientX: number) => {
    isDragging.current = true;
    document.body.style.cursor = 'ew-resize';
    handleMove(clientX);
    window.addEventListener('mousemove', handleInteractionMove);
    window.addEventListener('mouseup', handleInteractionEnd);
    window.addEventListener('touchmove', handleInteractionMove, { passive: false });
    window.addEventListener('touchend', handleInteractionEnd);
  }, [handleMove, handleInteractionMove, handleInteractionEnd]);

  // Mouse event for starting drag
  const onMouseDown = (e: React.MouseEvent) => {
      if (e.button !== 0) return;
      e.preventDefault();
      handleInteractionStart(e.clientX);
  }
  
  // Touch event for starting drag
  const onTouchStart = (e: React.TouchEvent) => {
      if (e.touches.length > 0) {
          // Prevent default to avoid scrolling while dragging slider on touch devices
          if (e.cancelable) e.preventDefault();
          handleInteractionStart(e.touches[0].clientX);
      }
  }

  // Keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (mode !== 'slider') return;
    const step = 5;
    if (e.key === 'ArrowLeft') {
      setSliderPosition(prev => Math.max(0, prev - step));
    } else if (e.key === 'ArrowRight') {
      setSliderPosition(prev => Math.min(100, prev + step));
    }
  };

  // Clean up listeners on unmount
  React.useEffect(() => {
      return () => {
          handleInteractionEnd();
      }
  }, [handleInteractionEnd]);
  
  if (mode === 'opacity') {
    return (
      <div
        ref={containerRef}
        className="relative w-full max-w-full max-h-full aspect-auto select-none overflow-hidden rounded-lg bg-black/20"
      >
        {/* Original Image (Before) - Bottom layer */}
        <img
          src={originalSrc}
          alt="Original"
          draggable={false}
          className="block w-full h-auto max-h-full object-contain mx-auto"
        />
        <div className="absolute top-2 left-2 bg-black/50 text-white text-xs font-bold uppercase tracking-wider px-2 py-1 rounded-md pointer-events-none z-10 shadow-sm">Antes</div>

        {/* Modified Image (After) - Top layer with opacity */}
        <img
          src={modifiedSrc}
          alt="Modificado"
          draggable={false}
          className="absolute top-0 left-0 block w-full h-auto max-h-full object-contain transition-opacity duration-100 mx-auto"
          style={{ 
            opacity: opacity / 100,
            filter: filterStyle, 
          }}
        />
        <div className="absolute top-2 right-2 bg-black/50 text-white text-xs font-bold uppercase tracking-wider px-2 py-1 rounded-md pointer-events-none z-10 shadow-sm" style={{ opacity: opacity / 100 }}>Depois</div>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className="relative w-full max-w-full max-h-full aspect-auto select-none overflow-hidden rounded-lg cursor-ew-resize bg-black/20 focus:outline-none focus:ring-2 focus:ring-blue-500"
      onMouseDown={onMouseDown}
      onTouchStart={onTouchStart}
      onKeyDown={handleKeyDown}
      tabIndex={0}
      aria-label="Slider de comparação de imagem. Use as setas esquerda e direita para ajustar."
      role="slider"
      aria-valuenow={sliderPosition}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      {/* Modified Image (After) - This is the background/base */}
      <img
        src={modifiedSrc}
        alt="Modificado"
        draggable={false}
        className="block w-full h-auto max-h-full object-contain mx-auto"
        style={{ filter: filterStyle, transition: 'filter 0.15s linear' }}
      />
      <div className="absolute top-2 right-2 bg-black/50 text-white text-xs font-bold uppercase tracking-wider px-2 py-1 rounded-md pointer-events-none z-10 shadow-sm">Depois</div>

      {/* Original Image (Before) - This is clipped */}
      <div
        className="absolute top-0 left-0 h-full w-full overflow-hidden"
        style={{ clipPath: `inset(0 ${100 - sliderPosition}% 0 0)` }}
      >
        <img
          src={originalSrc}
          alt="Original"
          draggable={false}
          className="block w-full h-auto max-h-full object-contain mx-auto"
        />
        <div className="absolute top-2 left-2 bg-black/50 text-white text-xs font-bold uppercase tracking-wider px-2 py-1 rounded-md pointer-events-none z-10 shadow-sm">Antes</div>
      </div>
      
      {/* Slider Handle */}
      <div
        className="absolute top-0 h-full w-1 bg-white/80 pointer-events-none shadow-[0_0_10px_rgba(0,0,0,0.5)]"
        style={{ left: `calc(${sliderPosition}% - 0.5px)` }}
        aria-hidden="true"
      >
        <div className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 bg-white rounded-full p-2 shadow-lg border border-gray-300">
          <LazyIcon name="CompareArrowsIcon" className="w-5 h-5 text-gray-800" />
        </div>
      </div>
    </div>
  );
};

export default ComparisonSlider;
