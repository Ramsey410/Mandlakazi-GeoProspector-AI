
export enum AnalysisStatus {
  IDLE = 'IDLE',
  UPLOADING = 'UPLOADING',
  FETCHING_SATELLITE = 'FETCHING_SATELLITE',
  PROCESSING_GEOPHYSICS = 'PROCESSING_GEOPHYSICS',
  SCRAPING_DATA = 'SCRAPING_DATA',
  ANALYZING_AI = 'ANALYZING_AI',
  COMPLETE = 'COMPLETE',
  ERROR = 'ERROR'
}

export interface Coordinates {
  lat: number;
  lng: number;
}

export interface GeoDataPoint {
  depth: number;
  resistivity: number;
  magneticSusceptibility: number;
}

export interface MiningReport {
  title: string;
  location: string;
  geologicalSummary: string;
  mineralPotential: string[];
  nearbyProjects: string[];
  recommendations: string;
  riskAssessment: string;
  sources: string[];
  rawMarkdown: string;
  isDeepAnalysis?: boolean;
}

export interface MapLayer {
  id: string;
  name: string;
  visible: boolean;
  opacity: number;
  type: 'satellite' | 'magnetic' | 'gravity' | 'geology' | 'radiometric' | 'electromagnetic';
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'model';
  text: string;
  timestamp: number;
  image?: string; // base64
  isThinking?: boolean;
}

export interface NearbyPlace {
  title: string;
  uri?: string;
}
