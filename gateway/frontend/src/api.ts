import axios, { InternalAxiosRequestConfig } from 'axios';

const API_URL = (import.meta as unknown as { env: Record<string, string | undefined> }).env.VITE_API_URL || `http://${window.location.hostname}:8000`;

export interface Tag {
  name: string;
  db: number;
  offset: number;
  bit?: number;
  type: string;
  value?: string | number | boolean;
}

export interface PLC {
  id: string;
  name: string;
  hall_id?: string;
  ip: string;
  rack: number;
  slot: number;
  type: string;
  tags: Tag[];
  online: boolean;
}

export interface Hall {
  id: string;
  name: string;
}

const api = axios.create({
  baseURL: API_URL,
});

// Interceptor do dodawania tokena JWT
api.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  const token = localStorage.getItem('token');
  if (token && config.headers) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export const createPLC = (plc: Omit<PLC, 'online'>) => api.post('/plcs', plc);
export const updatePLC = (id: string, plc: Omit<PLC, 'online'>) => api.put(`/plcs/${id}`, plc);
export const deletePLC = (id: string) => api.delete(`/plcs/${id}`);
export const getPLCs = () => api.get<PLC[]>('/plcs');

export const getHalls = () => api.get<Hall[]>('/halls');
export const createHall = (hall: Hall) => api.post('/halls', hall);
export const deleteHall = (id: string) => api.delete(`/halls/${id}`);

export default api;
