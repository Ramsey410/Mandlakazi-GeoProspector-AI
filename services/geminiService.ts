
import { GoogleGenAI, Type } from "@google/genai";
import { Coordinates, MiningReport, NearbyPlace } from '../types';

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

export const analyzeGeology = async (
  coords: Coordinates, 
  locationName: string, 
  areaPolygon?: Coordinates[],
  mineralFocus?: string
): Promise<MiningReport> => {
  
  let locationContext = `coordinates: ${coords.lat}, ${coords.lng} (${locationName})`;
  let areaPrompt = "";

  if (areaPolygon && areaPolygon.length >= 3) {
      const polyStr = areaPolygon.map(p => `[${p.lat.toFixed(5)}, ${p.lng.toFixed(5)}]`).join(', ');
      locationContext += `. \nANALYSIS BOUNDARY: Focused strictly within polygon: ${polyStr}.`;
      areaPrompt = "Evaluate the geological continuity and structural containment within this specific polygonal boundary.";
  }

  const focusPrompt = mineralFocus ? `\nSPECIAL FOCUS: The client is primarily interested in finding ${mineralFocus}. Tailor the entire analysis, anomaly detection simulation, and feasibility study to focus on these specific minerals.` : "";

  const prompt = `
    Perform a comprehensive geological and geophysical evaluation for a mining project at ${locationContext}.
    ${areaPrompt}${focusPrompt}
    
    You are simulating an advanced GeoAI pipeline. 
    1. ACT AS A SENIOR GEOLOGIST.
    2. Use Google Search to find real geological data, active mining projects, and stratigraphy for this specific region.
    3. SIMULATE the results of analyzing Sentinel-2 spectral data and airborne magnetic surveys.
    4. Structure the report as a professional "Preliminary Economic Assessment" (PEA).

    CRITICAL: You must output PURE JSON text without Markdown formatting blocks.
    The JSON must match this structure exactly:
    {
      "title": "Project Title",
      "location": "Location Description",
      "geologicalSummary": "Detailed summary...",
      "mineralPotential": ["List", "of", "minerals"],
      "nearbyProjects": ["Project A", "Project B"],
      "recommendations": "Exploration recommendations...",
      "riskAssessment": "Geological and operational risks...",
      "sources": ["List of URL sources found via search"],
      "rawMarkdown": "A full markdown formatted version of the report including all sections."
    }
  `;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-pro-preview',
      contents: prompt,
      config: {
        tools: [{ googleSearch: {} }],
      }
    });

    let jsonStr = response.text || "{}";
    jsonStr = jsonStr.replace(/```json\n?/g, '').replace(/```\n?/g, '');
    
    const groundingSources = response.candidates?.[0]?.groundingMetadata?.groundingChunks
        ?.map((c: any) => c.web?.uri)
        .filter((uri: string) => uri) || [];
        
    let parsedData: MiningReport;
    try {
        parsedData = JSON.parse(jsonStr) as MiningReport;
    } catch (e) {
        parsedData = {
            title: `Exploration Report: ${locationName}`,
            location: `${coords.lat}, ${coords.lng}`,
            geologicalSummary: response.text || "Analysis complete but formatting failed.",
            mineralPotential: [],
            nearbyProjects: [],
            recommendations: "Review raw output.",
            riskAssessment: "N/A",
            sources: [],
            rawMarkdown: response.text || ""
        };
    }
    
    parsedData.mineralFocus = mineralFocus;
    parsedData.sources = [...new Set([...(parsedData.sources || []), ...groundingSources])];

    return parsedData;
  } catch (error) {
    console.error("Gemini Analysis Error:", error);
    throw error;
  }
};

export const performDeepThinkingAnalysis = async (coords: Coordinates, locationName: string): Promise<string> => {
  const prompt = `Conduct an extremely deep, theoretical geological analysis of the area at ${coords.lat}, ${coords.lng} (${locationName}). Consider deep crustal structures and tectonics.`;
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-pro-preview',
      contents: prompt,
      config: { thinkingConfig: { thinkingBudget: 32768 } }
    });
    return response.text || "Analysis failed.";
  } catch (error) {
    return "Deep thinking analysis unavailable.";
  }
};

export const quickGeologyScan = async (coords: Coordinates): Promise<string> => {
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-flash-lite-latest',
      contents: `Provide a 1-sentence quick geological summary of coords ${coords.lat}, ${coords.lng}.`,
    });
    return response.text || "No data.";
  } catch (error) {
    return "";
  }
};

export const findNearbyMines = async (coords: Coordinates): Promise<NearbyPlace[]> => {
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: `List active mining operations near latitude ${coords.lat}, longitude ${coords.lng}.`,
      config: {
        tools: [{ googleMaps: {} }],
        toolConfig: { retrievalConfig: { latLng: { latitude: coords.lat, longitude: coords.lng } } }
      }
    });
    const places: NearbyPlace[] = [];
    (response.text || "").split('\n').forEach(line => {
        if (line.includes('- ') || line.match(/^\d\./)) places.push({ title: line.replace(/[-*]\s/, '').trim() });
    });
    return places;
  } catch (error) {
    return [];
  }
};

export const sendChatMessage = async (history: any[], newMessage: string, imageBase64?: string): Promise<string> => {
  try {
    let parts: any[] = [];
    if (imageBase64) {
        parts.push({ inlineData: { mimeType: "image/jpeg", data: imageBase64 } });
        parts.push({ text: "Analyze this: " + newMessage });
    } else {
        parts.push({ text: newMessage });
    }
    const chat = ai.chats.create({
        model: 'gemini-3-pro-preview',
        history: history.map(h => ({ role: h.role, parts: [{ text: h.text }] }))
    });
    const result = await chat.sendMessage({ message: { parts: parts } });
    return result.text || "Error.";
  } catch (error) {
    return "Chat error.";
  }
};

export const generateChartData = async (coords: Coordinates): Promise<any[]> => {
    const prompt = `Generate a JSON array of 20 depth sounding points at ${coords.lat}, ${coords.lng}.`;
    try {
        const response = await ai.models.generateContent({
            model: 'gemini-3-flash-preview',
            contents: prompt,
            config: {
                responseMimeType: "application/json",
                responseSchema: {
                  type: Type.ARRAY,
                  items: {
                    type: Type.OBJECT,
                    properties: {
                      depth: { type: Type.NUMBER },
                      resistivity: { type: Type.NUMBER },
                      magneticSusceptibility: { type: Type.NUMBER }
                    },
                    required: ["depth", "resistivity", "magneticSusceptibility"]
                  }
                }
            }
        });
        if(response.text) return JSON.parse(response.text);
        return [];
    } catch (e) {
        return [];
    }
}
