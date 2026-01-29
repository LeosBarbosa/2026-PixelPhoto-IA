
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import React from 'react';
import { type Trend } from '../types';

export const quickStyles: Trend[] = [
    {
        name: 'Estilo Anime',
        prompt: 'Transforme a foto em um personagem de anime dos anos 90, com cores vibrantes e linhas nítidas.',
        bg: 'bg-gradient-to-br from-pink-400 to-purple-500',
        icon: 'AnimeFaceIcon',
    },
    {
        name: 'Amigurumi',
        prompt: 'Hyper-realistic photograph, an adorable handmade patchwork fabric amigurumi made from upcycled cotton scraps, extremely detailed visible mismatched seams, frayed thread edges, varied fabric prints and textures, soft stuffed volume with gentle puckering and folds, charming handmade imperfections, professional product photography, studio lighting, subtle bokeh, against White BACKGROUND, vertical composition, ultra-detailed, 8k, photorealistic, macro photography style.',
        bg: 'bg-gradient-to-br from-orange-400 to-amber-600',
        icon: 'ToyIcon',
    },
    {
        name: 'Cyberpunk',
        prompt: 'Estilo cyberpunk, com luzes de neon, atmosfera sombria e chuvosa, detalhes de alta tecnologia.',
        bg: 'bg-gradient-to-br from-cyan-400 to-indigo-600',
        icon: 'BoltIcon',
    },
    {
        name: 'Foto Antiga',
        prompt: 'Fotografia antiga em preto e branco, com grão de filme, leve sépia, cantos suavemente vinhetados e iluminação suave de janela.',
        bg: 'bg-gradient-to-br from-stone-500 to-stone-700',
        icon: 'ClockIcon',
    }
];
