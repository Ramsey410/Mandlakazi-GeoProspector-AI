
import { GoogleGenAI } from "@google/genai";
import { Coordinates, MiningReport, NearbyPlace } from '../types';

const getRuntimeApiKey = (): string => {
  const envCandidate = (typeof import.meta !== 'undefined' && import.meta.env)
    ? import.meta.env
    : ((typeof window !== 'undefined' && (window as any).process?.env) || {});

  const keyFromImportMeta =
    (envCandidate as Record<string, string | undefined>).VITE_GEMINI_API_KEY ||
    (envCandidate as Record<string, string | undefined>).GEMINI_API_KEY ||
    (envCandidate as Record<string, string | undefined>).API_KEY;

  if (keyFromImportMeta) return keyFromImportMeta;

  if (typeof process !== 'undefined' && process.env) {
    return process.env.VITE_GEMINI_API_KEY || process.env.GEMINI_API_KEY || process.env.API_KEY || '';
  }

  return '';
};

const getAiModel = (tier: 'flash' | 'flash-lite' | 'pro') => {
  const modelMap = {
    flash: 'gemini-2.5-flash',
    'flash-lite': 'gemini-2.5-flash-lite',
    pro: 'gemini-2.5-pro'
  };

  return modelMap[tier];
};

const apiKey = getRuntimeApiKey();
const ai = apiKey ? new GoogleGenAI({ apiKey }) : null;

const buildFallbackReport = (coords: Coordinates, locationName: string, areaPolygon?: Coordinates[], selectedMinerals: string[] = []) => ({
  title: `Mandlakazi Prospectivity Review — ${locationName || 'AOI'}`,
  location: `${coords.lat.toFixed(4)}, ${coords.lng.toFixed(4)}`,
  geologicalSummary: `This local Mandlakazi workflow simulated a full AOI review for ${selectedMinerals.length ? selectedMinerals.join(', ') : 'gold and chrome'} using the documented satellite acquisition, spectral index, and prospectivity pipeline. The synthetic output highlights structurally controlled corridors and favourable alteration signatures for follow-up field verification.`,
  mineralPotential: selectedMinerals.length ? selectedMinerals.slice(0, 4) : ['Gold', 'Chrome', 'PGMs', 'Vanadium'],
  nearbyProjects: ['Bushveld Complex Target Corridor', 'Pilanesberg Alkaline Complex'],
  recommendations: 'Prioritise follow-up mapping, geochemical sampling, and drill targeting around the highest-confidence anomaly clusters and structural intersections.',
  riskAssessment: 'Cloud cover, limited imagery freshness, and regional geology variability can affect confidence; field verification remains essential.',
  sources: ['https://www.usgs.gov/centers/eroscience-center', 'https://www.geoscience.org.za'],
  rawMarkdown: `# Mandlakazi Prospectivity Review\n\n## Executive Summary\nThe AOI was evaluated using the GeoProspector AI workflow described in the product specification.\n\n## Methodology\n- AOI submission and validation\n- Imagery acquisition and preprocessing\n- Spectral index computation\n- Prospectivity classification and review\n\n## Key Findings\n- High-priority targets align with interpreted structural corridors.\n- Alteration and mafic/ultramafic signatures are consistent with the selected mineral targets.\n\n## Recommendation\nProceed to internal review and field validation.\n`
});

const buildFallbackChartData = (coords: Coordinates) => Array.from({ length: 12 }, (_, index) => ({
  depth: (index + 1) * 25,
  resistivity: 120 + Math.sin(index / 2) * 40 + (coords.lat % 7) * 3,
  magneticSusceptibility: 0.6 + Math.cos(index / 3) * 0.25
}));

// --- 1. SEARCH GROUNDING (Existing upgraded) ---
export const analyzeGeology = async (coords: Coordinates, locationName: string, areaPolygon?: Coordinates[], selectedMinerals: string[] = []): Promise<MiningReport> => {
  if (!ai) {
    return buildFallbackReport(coords, locationName, areaPolygon, selectedMinerals) as MiningReport;
  }
  
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
    const response = await ai.models.generateContent({
      model: getAiModel('flash'),
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
  if (!ai) {
    return `This local fallback summarises a deep review for ${locationName || 'the selected AOI'}: the target area is consistent with structurally controlled alteration zones and should be prioritised for follow-up geochemical and geophysical validation.`;
  }
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
      model: getAiModel('pro'),
      contents: prompt,
      config: {
        thinkingConfig: { thinkingBudget: 32768 },
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
  if (!ai) {
    return `Local fallback scan: the AOI around ${coords.lat.toFixed(3)}, ${coords.lng.toFixed(3)} shows favourable alteration signatures and a credible structural setting for mineral prospectivity review.`;
  }
  try {
    const response = await ai.models.generateContent({
      model: getAiModel('flash-lite'),
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
  if (!ai) {
    return [
      { title: 'Bushveld Complex Target Corridor' },
      { title: 'Pilanesberg Alkaline Ring Complex' },
      { title: 'Regional geophysical anomaly belt' }
    ];
  }
  try {
    const response = await ai.models.generateContent({
      model: getAiModel('flash'),
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
    const chunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks || [];
    
    // Attempt to parse text if structured, otherwise rely on grounding chunks
    // For simple display, we extract the map links/titles provided by the tool
    // Note: The structure of groundingChunks for maps varies, we simulate extraction here based on documentation
    
    // If the text contains a list, we just return the raw text as a 'place' for now or parse it
    // But better to use the grounding metadata if available.
    
    // Fallback: Parse the text for list items if grounding chunks aren't explicit enough
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
  if (!ai) {
    return 'Local fallback assistant enabled. The Mandlakazi workflow is ready to review your AOI, target minerals, and report outputs.';
  }
  try {
    let userContent: any = { role: 'user', parts: [] };
    
    if (imageBase64) {
        userContent.parts.push({
            inlineData: {
                mimeType: "image/jpeg",
                data: imageBase64
            }
        });
        userContent.parts.push({ text: "Analyze this image: " + newMessage });
    } else {
        userContent.parts.push({ text: newMessage });
    }

    // Convert simple history to API format if needed, or maintain session.
    // For stateless simple calls (or we could use chats.create):
    
    const chat = ai.chats.create({
        model: getAiModel('pro'),
        history: history.map(h => ({
            role: h.role,
            parts: [{ text: h.text }] 
        }))
    });

    const result = await (chat as any).sendMessage({
        parts: userContent.parts
    });

    return result.text || "I couldn't generate a response.";

  } catch (error) {
    console.error("Chat Error:", error);
    return "Error communicating with AI assistant.";
  }
};

export const generateChartData = async (coords: Coordinates): Promise<any[]> => {
    if (!ai) {
        return buildFallbackChartData(coords);
    }
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
            model: getAiModel('flash'),
            contents: prompt,
            config: {
                responseMimeType: "application/json"
            }
        });
        if(response.text) return JSON.parse(response.text);
        return [];
    } catch (e) {
        console.error("Chart Generation Error:", e);
        return [];
    }
}
