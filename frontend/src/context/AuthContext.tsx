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
    const initAuth = async () => {
      const savedToken = localStorage.getItem('token');
      const savedUser = localStorage.getItem('user');
      const savedMenus = localStorage.getItem('menus');

      if (savedToken && savedUser) {
        setUser(JSON.parse(savedUser));
        if (savedMenus) {
          setMenus(JSON.parse(savedMenus));
        }
        try {
          const res = await api.get('/auth/me');
          setUser(res.data);
          setMenus(res.data.menus || []);
          localStorage.setItem('user', JSON.stringify(res.data));
          localStorage.setItem('menus', JSON.stringify(res.data.menus || []));
        } catch {
          // invalid token
          logout();
        }
      }
      setIsLoading(false);
    };

    initAuth();
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
