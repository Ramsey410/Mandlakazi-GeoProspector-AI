
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
  targetMinerals?: string;
  isDeepAnalysis?: boolean;
  mapSnapshot?: string; // Base64 or URL of the captured map view
}

export interface MapLayer {
  id: string;
  name: string;
  visible: boolean;
  opacity: number;
  type: 'satellite' | 'magnetic' | 'gravity' | 'geology' | 'radiometric' | 'electromagnetic' | 'terrain' | 'spectral';
  showContours?: boolean;
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

export interface User {
  email: string;
  name: string;
  avatar?: string;
}
