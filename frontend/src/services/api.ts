import axios from 'axios';

const TOKEN_KEY = 'token';
const USER_KEY = 'user';
const MENUS_KEY = 'menus';

// Session data (token, user, menus) is cached ONLY in sessionStorage — a per-tab
// cache that is wiped automatically when the tab/browser closes and cleared
// explicitly on logout. Nothing user-related is persisted in localStorage.
const readToken = (): string | null => {
  try {
    return sessionStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
};

// Removes every cached session artifact from both storages. Called on logout,
// on 401 responses, and during app startup to purge sessions persisted by
// older versions of the app.
export const clearSessionCache = () => {
  try {
    sessionStorage.removeItem(TOKEN_KEY);
    sessionStorage.removeItem(USER_KEY);
    sessionStorage.removeItem(MENUS_KEY);
    // Purge legacy persisted copies so no user data survives in localStorage.
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    localStorage.removeItem(MENUS_KEY);
  } catch {
    // Storage unavailable (blocked by browser) — nothing to clear.
  }
};

// Origin of the PromotionExam Web API, set per build via VITE_API_BASE_URL
// (see .env.production). Empty means same origin, e.g. the Vite dev proxy.
export const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL ?? '').replace(/\/+$/, '');

// The API returns server-relative file paths (e.g. "/uploads/logos/x.png"); these must
// load from the API host, not from the host serving the frontend.
export const resolveApiUrl = (path?: string | null): string | undefined => {
  if (!path) return undefined;
  if (/^(https?:|data:|blob:)/i.test(path)) return path;
  return `${API_BASE_URL}${path.startsWith('/') ? '' : '/'}${path}`;
};

const api = axios.create({
  baseURL: `${API_BASE_URL}/api`,
  headers: {
    'Content-Type': 'application/json',
  },
  // AI marking requests can take 10-30s per Gemini call. A hard timeout guarantees
  // the UI never keeps a button stuck in "Analyzing.../Processing" forever when a
  // request hangs (e.g. dropped internet connection mid-call).
  timeout: 120000,
});

// Request interceptor: attach the in-memory session token
api.interceptors.request.use(
  (config) => {
    const token = readToken();
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor: on 401 the session is dead — wipe ALL cached
// session data so the user cannot do anything until they sign in again.
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      clearSessionCache();
      if (window.location.pathname !== '/login') {
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  }
);

export default api;
