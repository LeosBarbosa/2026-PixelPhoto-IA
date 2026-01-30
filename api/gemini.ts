
import { GoogleGenAI } from "@google/genai";

export default async function handler(req: any, res: any) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
  );

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    const { model, contents, config, task, prompt } = req.body;
    const apiKey = process.env.API_KEY;

    if (!apiKey) {
      return res.status(500).json({ error: 'Server API Key not configured' });
    }

    const ai = new GoogleGenAI({ apiKey });

    let result;

    if (task === 'generateImages') {
        // Handle Imagen models
        result = await ai.models.generateImages({
            model,
            prompt, // generateImages uses 'prompt', not 'contents'
            config
        });
    } else {
        // Handle Gemini models (generateContent)
        result = await ai.models.generateContent({
            model,
            contents,
            config
        });
    }

    // Handle BigInt serialization for usage metadata
    const jsonResponse = JSON.stringify(result, (key, value) =>
      typeof value === 'bigint' ? value.toString() : value
    );

    res.status(200).send(jsonResponse);

  } catch (error: any) {
    console.error("Backend Gemini Error:", error);
    res.status(500).json({ 
        error: error.message || 'Internal Server Error',
        details: error.toString() 
    });
  }
}
