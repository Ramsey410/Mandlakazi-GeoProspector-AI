
import { GoogleGenAI, Type } from "@google/genai";
import { Coordinates, MiningReport, NearbyPlace } from '../types';

// ALWAYS use a named parameter and process.env.API_KEY directly.
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

/**
 * Performs a comprehensive geological analysis.
 * Returns a structured report object that includes a rawMarkdown field
 * which is optimized for high-quality PDF generation.
 */
export const analyzeGeology = async (coords: Coordinates, locationName: string, targetMinerals: string, areaPolygon?: Coordinates[]): Promise<MiningReport> => {
  
  let locationContext = `coordinates: ${coords.lat}, ${coords.lng} (${locationName})`;
  let areaPrompt = "";

  if (areaPolygon && areaPolygon.length >= 3) {
      const polyStr = areaPolygon.map(p => `[${p.lat.toFixed(5)}, ${p.lng.toFixed(5)}]`).join(', ');
      locationContext += `. \nANALYSIS BOUNDARY: The analysis MUST be strictly focused within the polygon defined by these coordinates: ${polyStr}.`;
      areaPrompt = "Evaluate the geological continuity, structural containment, and mineralization potential strictly within this specific polygonal boundary.";
  }

  const mineralFocus = targetMinerals ? `FOCUS MINERALS: The user is specifically targeting [${targetMinerals}]. Prioritize detecting indices and alteration signatures for these elements.` : "";

  const prompt = `
    Perform an exhaustive end-to-end geological and geophysical mapping for an exploration dossier at ${locationContext}.
    ${areaPrompt}
    ${mineralFocus}
    
    You are an elite exploration consultant. Generate a technical dossier leveraging advanced spectral and geophysical datasets.
    
    DATA SOURCES TO INTEGRATE IN ANALYSIS:
    1. ASTER (Terra): Utilize SWIR/TIR bands for hydrothermal alteration mapping (e.g., alunite, kaolinite, silica indices).
    2. WorldView-3: High-resolution VNIR/SWIR for precise lithological classification.
    3. Fireflies Constellation: Thermal and optical monitoring for surface anomalies.
    4. Wyvern: Hyperspectral imagery for high-fidelity mineral identification.
    5. Geophysics: Simulated Airborne Magnetics, Gravity, and VRP based on regional stratigraphy.
    
    REPORT STRUCTURE REQUIREMENTS:
    The user requires a formal PDF dossier. Compose the report in professional technical prose.
    - Mention specific spectral signatures found (e.g., "ASTER Band 4/6 ratio suggests high phyllosilicate density").
    - Correlate spectral anomalies with magnetic and gravity gradients.
    - Evaluate ${targetMinerals || "general minerals"} potential based on the geological setting.
    
    JSON Structure (Return ONLY valid JSON):
    {
      "title": "A professional project name (e.g., 'The [Location] [Minerals] Target')",
      "location": "Formal geographic description",
      "geologicalSummary": "Technical summary including spectral and structural findings.",
      "mineralPotential": ["Primary Target", "Secondary Target"],
      "nearbyProjects": ["Real mine names in this district"],
      "recommendations": "Phase 1/2/3 exploration strategy.",
      "riskAssessment": "Comprehensive hazard index.",
      "sources": ["Citations of real surveys and spectral databases"],
      "rawMarkdown": "A complete, beautifully formatted Markdown document for the PDF dossier. Use headers, bolding, and clear technical sections including 'Spectral Analysis Findings' and 'Geophysical Correlation'."
    }
  `;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-pro-preview',
      contents: prompt,
      config: {
        tools: [{ googleSearch: {} }],
        responseMimeType: "application/json"
      }
    });

    const jsonStr = response.text || "{}";
    const groundingSources = response.candidates?.[0]?.groundingMetadata?.groundingChunks
        ?.map((c: any) => c.web?.uri)
        .filter((uri: string) => uri) || [];
        
    let parsedData: MiningReport;
    try {
        parsedData = JSON.parse(jsonStr) as MiningReport;
        parsedData.targetMinerals = targetMinerals;
    } catch (e) {
        console.warn("JSON Parsing error, using raw text", e);
        parsedData = {
            title: `Exploration Dossier: ${locationName}`,
            location: `${coords.lat}, ${coords.lng}`,
            geologicalSummary: "Analysis generated successfully.",
            mineralPotential: ["Unknown"],
            nearbyProjects: [],
            recommendations: "Further ground-truthing required.",
            riskAssessment: "Information limited.",
            sources: [],
            targetMinerals: targetMinerals,
            rawMarkdown: response.text || "# Exploration Report\nNo markdown available."
        };
    }
    
    if (parsedData.sources) {
        parsedData.sources = [...new Set([...parsedData.sources, ...groundingSources])];
    } else {
        parsedData.sources = groundingSources;
    }

    return parsedData;

  } catch (error) {
    console.error("Analysis Error:", error);
    throw error;
  }
};

export const performDeepThinkingAnalysis = async (coords: Coordinates, locationName: string): Promise<string> => {
  const prompt = `
    Conduct an extremely deep, theoretical geological analysis of the area at ${coords.lat}, ${coords.lng} (${locationName}).
    Provide a dense, highly technical treatise suitable for a peer-reviewed exploration journal.
  `;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-pro-preview',
      contents: prompt,
      config: {
        thinkingConfig: { thinkingBudget: 32768 },
      }
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
      contents: `Provide a 1-sentence quick geological summary of the area at coordinates ${coords.lat}, ${coords.lng}.`,
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
        toolConfig: {
            retrievalConfig: {
                latLng: { latitude: coords.lat, longitude: coords.lng }
            }
        }
      }
    });

    const places: NearbyPlace[] = [];
    const lines = (response.text || "").split('\n').filter(l => l.includes('- ') || l.match(/^\d\./));
    lines.forEach(line => {
        places.push({ title: line.replace(/[-*]\s/, '').trim() });
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
        parts.push({ text: "Analyze this geological image: " + newMessage });
    } else {
        parts.push({ text: newMessage });
    }
    const chat = ai.chats.create({
        model: 'gemini-3-pro-preview',
        history: history.map(h => ({ role: h.role, parts: [{ text: h.text }] }))
    });
    const result = await chat.sendMessage({ message: { parts: parts } });
    return result.text || "I couldn't generate a response.";
  } catch (error) {
    return "Error communicating with AI assistant.";
  }
};

export const generateChartData = async (coords: Coordinates): Promise<any[]> => {
    const prompt = `Generate a JSON array of 20 objects for a simulated borehole log at ${coords.lat}, ${coords.lng}. Fields: depth (meters), resistivity (Ohm-m), magneticSusceptibility (SI).`;
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
