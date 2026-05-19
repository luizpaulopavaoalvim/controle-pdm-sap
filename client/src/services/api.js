import axios from 'axios';

function resolveApiUrl() {
  if (import.meta.env.VITE_API_URL) return import.meta.env.VITE_API_URL;
  if (typeof window !== 'undefined' && window.location.hostname) {
    return `${window.location.protocol}//${window.location.hostname}:4000/api`;
  }
  return 'http://127.0.0.1:4000/api';
}

export const API_URL = resolveApiUrl();

export const api = axios.create({
  baseURL: API_URL
});

export function downloadUrl(path) {
  return `${API_URL}${path}`;
}
