
import { GoogleGenAI, Type } from "@google/genai";
import { Coordinates, MiningReport, NearbyPlace } from '../types';

// ALWAYS use a named parameter and process.env.API_KEY directly.
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

// --- 1. SEARCH GROUNDING (Existing upgraded) ---
export const analyzeGeology = async (coords: Coordinates, locationName: string, areaPolygon?: Coordinates[]): Promise<MiningReport> => {
  
  let locationContext = `coordinates: ${coords.lat}, ${coords.lng} (${locationName})`;
  let areaPrompt = "";

  if (areaPolygon && areaPolygon.length >= 3) {
      const polyStr = areaPolygon.map(p => `[${p.lat.toFixed(5)}, ${p.lng.toFixed(5)}]`).join(', ');
      locationContext += `. \nANALYSIS BOUNDARY: The analysis MUST be strictly focused within the polygon defined by these coordinates: ${polyStr}.`;
      areaPrompt = "Evaluate the geological continuity and structural containment within this specific polygonal boundary.";
  }

  const prompt = `
    Perform a comprehensive geological and geophysical evaluation for a mining project at ${locationContext}.
    ${areaPrompt}
    
    You are simulating an advanced GeoAI pipeline. 
    1. ACT AS A SENIOR GEOLOGIST.
    2. Use Google Search to find real geological data, active mining projects, and stratigraphy for this specific region (especially looking for data from geoscience.org.za, mintek.co.za, and dmre.gov.za if in South Africa, or USGS/local surveys otherwise).
    3. SIMULATE the results of analyzing Sentinel-2 spectral data and airborne magnetic surveys for this area. What likely anomalies would exist here based on the known regional geology?
    4. Structure the report as a professional "Preliminary Economic Assessment" (PEA) chapter.

    CRITICAL: You must output PURE JSON text without Markdown formatting blocks (no \`\`\`json).
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
    // For Complex Text Tasks with Search Grounding: 'gemini-3-pro-preview'
    const response = await ai.models.generateContent({
      model: 'gemini-3-pro-preview',
      contents: prompt,
      config: {
        tools: [{ googleSearch: {} }],
      }
    });

    // Access text property directly (it is a property, not a method).
    let jsonStr = response.text || "{}";
    jsonStr = jsonStr.replace(/```json\n?/g, '').replace(/```\n?/g, '');
    
    const groundingSources = response.candidates?.[0]?.groundingMetadata?.groundingChunks
        ?.map((c: any) => c.web?.uri)
        .filter((uri: string) => uri) || [];
        
    let parsedData: MiningReport;
    try {
        parsedData = JSON.parse(jsonStr) as MiningReport;
    } catch (e) {
        console.warn("Malformed JSON from Gemini, attempting soft fail", e);
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
    
    if (parsedData.sources) {
        parsedData.sources = [...new Set([...parsedData.sources, ...groundingSources])];
    } else {
        parsedData.sources = groundingSources;
    }

    return parsedData;

  } catch (error) {
    console.error("Gemini Analysis Error:", error);
    throw error;
  }
};

// --- 2. DEEP THINKING MODE ---
export const performDeepThinkingAnalysis = async (coords: Coordinates, locationName: string): Promise<string> => {
  const prompt = `
    Conduct an extremely deep, theoretical geological analysis of the area at ${coords.lat}, ${coords.lng} (${locationName}).
    
    Consider:
    - Deep crustal structures and tectonic history.
    - Hydrothermal fluid flow pathways.
    - Potential for hidden/blind deposits under cover.
    - Compare with similar geological settings globally.
    
    Provide a highly technical, dense geological treatise.
  `;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-pro-preview',
      contents: prompt,
      config: {
        thinkingConfig: { thinkingBudget: 32768 }, // max budget for gemini-3-pro-preview
      }
    });
    return response.text || "Analysis failed.";
  } catch (error) {
    console.error("Deep Thinking Error:", error);
    return "Deep thinking analysis unavailable.";
  }
};

// --- 3. FAST LOW-LATENCY RESPONSE ---
export const quickGeologyScan = async (coords: Coordinates): Promise<string> => {
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-flash-lite-latest', // Correct model alias for gemini lite or flash lite
      contents: `Provide a 1-sentence quick geological summary of the area at coordinates ${coords.lat}, ${coords.lng}. Fast response needed.`,
    });
    return response.text || "No data.";
  } catch (error) {
    console.error("Quick Scan Error:", error);
    return "";
  }
};

// --- 4. MAPS GROUNDING ---
export const findNearbyMines = async (coords: Coordinates): Promise<NearbyPlace[]> => {
  try {
    // Maps grounding is only supported in Gemini 2.5 series models.
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: `List active mining operations or significant geological sites near latitude ${coords.lat}, longitude ${coords.lng}.`,
      config: {
        tools: [{ googleMaps: {} }],
        toolConfig: {
            retrievalConfig: {
                latLng: { latitude: coords.lat, longitude: coords.lng }
            }
        }
      }
    });

    // Extract grounding chunks for Maps
    const places: NearbyPlace[] = [];
    
    const lines = (response.text || "").split('\n').filter(l => l.includes('- ') || l.match(/^\d\./));
    lines.forEach(line => {
        places.push({ title: line.replace(/[-*]\s/, '').trim() });
    });

    return places;
  } catch (error) {
    console.error("Maps Grounding Error:", error);
    return [];
  }
};

// --- 5. CHATBOT & VISION ---
export const sendChatMessage = async (history: any[], newMessage: string, imageBase64?: string): Promise<string> => {
  try {
    let parts: any[] = [];
    
    if (imageBase64) {
        parts.push({
            inlineData: {
                mimeType: "image/jpeg",
                data: imageBase64
            }
        });
        parts.push({ text: "Analyze this image: " + newMessage });
    } else {
        parts.push({ text: newMessage });
    }

    const chat = ai.chats.create({
        model: 'gemini-3-pro-preview', // Capable of complex reasoning
        history: history.map(h => ({
            role: h.role,
            parts: [{ text: h.text }] 
        }))
    });

    // chat.sendMessage only accepts the message parameter.
    const result = await chat.sendMessage({
        message: { parts: parts }
    });

    return result.text || "I couldn't generate a response.";

  } catch (error) {
    console.error("Chat Error:", error);
    return "Error communicating with AI assistant.";
  }
};

export const generateChartData = async (coords: Coordinates): Promise<any[]> => {
    const prompt = `
      Generate a JSON array of 20 objects representing a simulated borehole log or depth sounding at ${coords.lat}, ${coords.lng}.
      Each object should have:
      - depth (meters, incrementing)
      - resistivity (Ohm-m, realistic values for the likely geology)
      - magneticSusceptibility (SI units)
      
      Based on the likely geology of this real-world location.
    `;

    try {
        const response = await ai.models.generateContent({
            model: 'gemini-3-flash-preview',
            contents: prompt,
            config: {
                responseMimeType: "application/json",
                // Use responseSchema for expected output.
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
        console.error("Chart Generation Error:", e);
        return [];
    }
}
