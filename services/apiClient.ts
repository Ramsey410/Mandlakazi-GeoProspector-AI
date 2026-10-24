import axios from 'axios';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:8000',
  headers: { 'Content-Type': 'application/json' }
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('geoprospector_access_token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

export interface AuthPayload {
  email: string;
  password: string;
}

export interface RegistrationPayload extends AuthPayload {
  username: string;
  full_name?: string;
  organization?: string;
}

export const register = async (payload: RegistrationPayload) => {
  const response = await api.post('/api/v1/auth/register', payload);
  localStorage.setItem('geoprospector_access_token', response.data.access_token);
  return response.data;
};

export const login = async (payload: AuthPayload) => {
  const response = await api.post('/api/v1/auth/login', payload);
  localStorage.setItem('geoprospector_access_token', response.data.access_token);
  return response.data;
};

export const getProfile = async () => (await api.get('/api/v1/auth/me')).data;

export const logout = () => localStorage.removeItem('geoprospector_access_token');

export const runAnalysis = async (payload: {
  coordinates: number[][][];
  mineral: string;
  name?: string;
  metadata?: Record<string, unknown>;
}) => (await api.post('/api/v1/analysis/run', payload)).data;

export const getAnalysisStatus = async (jobId: string) =>
  (await api.get(`/api/v1/analysis/status/${jobId}`)).data;

export const getAnalysisResults = async (jobId: string) =>
  (await api.get(`/api/v1/analysis/results/${jobId}`)).data;

export const getReportUrl = async (jobId: string) =>
  (await api.get(`/api/v1/analysis/report/${jobId}`)).data;

export default api;
