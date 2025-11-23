import { GoogleGenAI } from "@google/genai";
import { Coordinates, MiningReport } from '../types';

const apiKey = process.env.API_KEY || '';
const ai = new GoogleGenAI({ apiKey });

export const analyzeGeology = async (coords: Coordinates, locationName: string): Promise<MiningReport> => {
  
  const prompt = `
    Perform a comprehensive geological and geophysical evaluation for a mining project at coordinates: ${coords.lat}, ${coords.lng} (${locationName}).
    
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
      model: 'gemini-2.5-flash',
      contents: prompt,
      config: {
        tools: [{ googleSearch: {} }],
        // responseMimeType and responseSchema are NOT allowed with googleSearch
      }
    });

    let jsonStr = response.text || "{}";
    
    // Clean up markdown code blocks if present
    jsonStr = jsonStr.replace(/```json\n?/g, '').replace(/```\n?/g, '');
    
    // Extract sources from grounding metadata if available
    const groundingSources = response.candidates?.[0]?.groundingMetadata?.groundingChunks
        ?.map((c: any) => c.web?.uri)
        .filter((uri: string) => uri) || [];
        
    let parsedData: MiningReport;
    
    try {
        parsedData = JSON.parse(jsonStr) as MiningReport;
    } catch (e) {
        // Fallback if JSON is malformed
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
    
    // Merge grounding sources
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

export const generateChartData = async (coords: Coordinates): Promise<any[]> => {
    // Simulating backend processing for chart data generation via Gemini
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
            model: 'gemini-2.5-flash',
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