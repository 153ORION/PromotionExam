import React, { createContext, useContext, useState, useEffect } from 'react';
import api from '../services/api';
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

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [menus, setMenus] = useState<MenuItem[]>([]);
  const [token, setToken] = useState<string | null>(localStorage.getItem('token'));
  const [isLoading, setIsLoading] = useState<boolean>(true);

  useEffect(() => {
    const clearSession = () => {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      localStorage.removeItem('menus');
    };

    const safeParse = <T,>(raw: string | null): T | null => {
      if (!raw) return null;
      try {
        return JSON.parse(raw) as T;
      } catch {
        return null;
      }
    };

    const initAuth = async () => {
      const savedToken = localStorage.getItem('token');
      const savedUser = safeParse<User>(localStorage.getItem('user'));
      const savedMenus = safeParse<MenuItem[]>(localStorage.getItem('menus'));

      if (savedToken && savedUser) {
        setUser(savedUser);
        if (savedMenus) {
          setMenus(savedMenus);
        }
        try {
          const res = await api.get('/auth/me');
          setUser(res.data);
          setMenus(res.data.menus || []);
          localStorage.setItem('user', JSON.stringify(res.data));
          localStorage.setItem('menus', JSON.stringify(res.data.menus || []));
        } catch {
          // invalid or expired token — clear session so the login page shows
          clearSession();
          setToken(null);
          setUser(null);
          setMenus([]);
        }
      } else if (savedToken || savedUser) {
        // Corrupted/partial session data — clear it so the login page shows
        clearSession();
        setToken(null);
        setUser(null);
        setMenus([]);
      }
      setIsLoading(false);
    };

    initAuth().catch(() => {
      // Never leave the app stuck in the loading state
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      localStorage.removeItem('menus');
      setToken(null);
      setUser(null);
      setMenus([]);
      setIsLoading(false);
    });
  }, []);

  const login = async (loginId: string, password: string) => {
    const res = await api.post<LoginResponse>('/auth/login', { loginId, password });
    const { token, menus, ...userData } = res.data;

    setToken(token);
    setUser(userData);
    setMenus(menus);

    localStorage.setItem('token', token);
    localStorage.setItem('user', JSON.stringify(userData));
    localStorage.setItem('menus', JSON.stringify(menus));
  };

  const logout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    localStorage.removeItem('menus');
    setToken(null);
    setUser(null);
    setMenus([]);
    window.location.href = '/login';
  };

  const refreshUser = async () => {
    try {
      const res = await api.get('/auth/me');
      setUser(res.data);
      setMenus(res.data.menus || []);
      localStorage.setItem('user', JSON.stringify(res.data));
      localStorage.setItem('menus', JSON.stringify(res.data.menus || []));
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
