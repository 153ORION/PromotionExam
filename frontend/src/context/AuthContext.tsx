import React, { createContext, useContext, useState, useEffect } from 'react';
import api, { clearSessionCache } from '../services/api';
import { User, MenuItem, LoginResponse } from '../types';

interface AuthContextType {
  user: User | null;
  menus: MenuItem[];
  token: string | null;
  isLoading: boolean;
  login: (loginId: string, password: string) => Promise<void>;
  logout: () => void;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Session data is cached in sessionStorage only (per-tab, wiped on tab close
// and on logout). These helpers never touch persistent localStorage.
const readRaw = (key: string): string | null => {
  try {
    return sessionStorage.getItem(key);
  } catch {
    return null;
  }
};

const writeJson = (key: string, value: unknown): void => {
  try {
    sessionStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Storage blocked — session will simply not survive a refresh.
  }
};

const safeParse = <T,>(raw: string | null): T | null => {
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [menus, setMenus] = useState<MenuItem[]>([]);
  const [token, setToken] = useState<string | null>(readRaw('token'));
  const [isLoading, setIsLoading] = useState<boolean>(true);

  const resetAuthState = () => {
    clearSessionCache();
    setToken(null);
    setUser(null);
    setMenus([]);
  };

  useEffect(() => {
    const initAuth = async () => {
      const savedToken = readRaw('token');
      const savedUser = safeParse<User>(readRaw('user'));
      const savedMenus = safeParse<MenuItem[]>(readRaw('menus'));

      if (savedToken && savedUser) {
        setUser(savedUser);
        if (savedMenus) {
          setMenus(savedMenus);
        }
        try {
          const res = await api.get('/auth/me');
          setUser(res.data);
          setMenus(res.data.menus || []);
          writeJson('user', res.data);
          writeJson('menus', res.data.menus || []);
        } catch {
          // invalid or expired token — clear session so the login page shows
          resetAuthState();
        }
      } else if (savedToken || savedUser) {
        // Corrupted/partial session data — clear it so the login page shows
        resetAuthState();
      } else {
        // No active session: purge anything persisted by older versions of
        // the app so no user data lingers in localStorage.
        clearSessionCache();
      }
      setIsLoading(false);
    };

    initAuth().catch(() => {
      // Never leave the app stuck in the loading state
      resetAuthState();
      setIsLoading(false);
    });
  }, []);

  const login = async (loginId: string, password: string) => {
    const res = await api.post<LoginResponse>('/auth/login', { loginId, password });
    const { token, menus, ...userData } = res.data;

    setToken(token);
    setUser(userData);
    setMenus(menus);

    try {
      sessionStorage.setItem('token', token);
      sessionStorage.setItem('user', JSON.stringify(userData));
      sessionStorage.setItem('menus', JSON.stringify(menus));
    } catch {
      // Storage blocked — session lives only in memory for this page load.
    }
  };

  const logout = () => {
    // Wipe ALL cached session data (token, user, menus) from sessionStorage
    // AND any legacy localStorage copies — after logout nothing remains and
    // every API call will be rejected until the user signs in again.
    resetAuthState();
    window.location.href = '/login';
  };

  const refreshUser = async () => {
    try {
      const res = await api.get('/auth/me');
      setUser(res.data);
      setMenus(res.data.menus || []);
      writeJson('user', res.data);
      writeJson('menus', res.data.menus || []);
    } catch {
      // ignore
    }
  };

  return (
    <AuthContext.Provider value={{ user, menus, token, isLoading, login, logout, refreshUser }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
