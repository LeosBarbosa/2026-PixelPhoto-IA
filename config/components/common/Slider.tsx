/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

import React, { useState } from 'react';

interface SliderProps {
    label: string;
    value: number;
    min: number;
    max: number;
    onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
    disabled: boolean;
    tooltip: string;
}

const Slider: React.FC<SliderProps> = ({ label, value, min, max, onChange, disabled, tooltip }) => {
    const [isTooltipVisible, setIsTooltipVisible] = useState(false);
    const thumbPositionPercent = max > min ? ((value - min) / (max - min)) * 100 : 0;

    return (
        <div title={tooltip}>
            <label className="text-sm font-medium text-gray-300 flex justify-between">
                <span>{label}</span>
                <span className="text-white font-mono">{value}</span>
            </label>
            <div 
                className="relative mt-4 mb-2"
                onMouseEnter={() => setIsTooltipVisible(true)}
                onMouseLeave={() => setIsTooltipVisible(false)}
            >
                <div
                    className={`slider-value-tooltip ${isTooltipVisible ? 'opacity-100' : 'opacity-0'}`}
                    style={{ left: `${thumbPositionPercent}%` }}
                >
                    {value}
                </div>
                <input
                    type="range"
                    min={min}
                    max={max}
                    value={value}
                    onChange={onChange}
                    disabled={disabled}
                    className="w-full"
                />
            </div>
            <div className="flex justify-between text-xs text-gray-400 -mt-1">
                <span>{min}</span>
                <span>{max}</span>
            </div>
        </div>
    );
};

export default Slider;