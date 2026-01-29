/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import { Type, type FunctionDeclaration } from '@google/genai';
import { tools } from '../config/tools';

// This creates more specific function declarations for the smart search orchestrator.
export const smartSearchToolDeclarations: FunctionDeclaration[] = tools
    // Only expose a subset of tools to smart search for better accuracy.
    .filter(tool => [
        'photoRestoration', 'removeBg', 'style', 'upscale', 'imageGen', 
        'generativeEdit', 'objectRemover', 'relight', 'adjust', 'crop'
    ].includes(tool.id))
    .map(tool => {
    const properties: Record<string, any> = {};
    const required: string[] = [];

    // Add tool-specific parameters to guide the model
    switch(tool.id) {
        case 'photoRestoration':
            properties['colorize'] = {
                type: Type.BOOLEAN,
                description: "Set to true if the user asks to add color ('cores') to a black and white photo. Defaults to true for general restoration prompts."
            };
            break;
        case 'style':
            properties['stylePrompt'] = {
                type: Type.STRING,
                description: "The artistic style to apply, e.g., 'anime', 'Van Gogh', 'cyberpunk', 'desenho animado'."
            };
            required.push('stylePrompt');
            break;
        case 'upscale':
            properties['factor'] = {
                type: Type.NUMBER,
                description: "The upscaling factor, e.g., 2, 4, or 8. If not specified, default to 4."
            };
            break;
        case 'imageGen':
        case 'generativeEdit':
        case 'relight':
        case 'adjust':
            properties['prompt'] = {
                type: Type.STRING,
                description: `The user's specific descriptive prompt for the generation or adjustment.`
            };
            required.push('prompt');
            break;
    }

    return {
        name: tool.id,
        description: tool.description,
        parameters: {
            type: Type.OBJECT,
            properties,
            required,
        },
    };
});
