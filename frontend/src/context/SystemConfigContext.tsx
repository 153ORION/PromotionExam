import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import api from '../services/api';

export interface SystemConfig {
  configId: number;
  companyName: string;
  companyShortName?: string;
  address?: string;
  phone?: string;
  email?: string;
  websiteUrl?: string;
  logoUrl?: string;
  examTermsNotice?: string;
  lastUpdatedDate?: string;
  updatedBy?: string;
}

interface SystemConfigContextType {
  config: SystemConfig | null;
  loading: boolean;
  refreshConfig: () => Promise<void>;
}

const SystemConfigContext = createContext<SystemConfigContextType | undefined>(undefined);

const LOCAL_STORAGE_KEY = 'pe_system_config';

export const SystemConfigProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [config, setConfig] = useState<SystemConfig | null>(() => {
    try {
      const saved = localStorage.getItem(LOCAL_STORAGE_KEY);
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });
  const [loading, setLoading] = useState<boolean>(!config);

  const applyBranding = (cfg: SystemConfig | null) => {
    if (!cfg) return;

    // Dynamically update document title
    if (cfg.companyName) {
      document.title = `${cfg.companyName} — Promotion Exam System`;
    }

    // Dynamically update favicon if logo exists
    if (cfg.logoUrl) {
      let link: HTMLLinkElement | null = document.querySelector("link[rel*='icon']");
      if (!link) {
        link = document.createElement('link');
        link.rel = 'icon';
        document.head.appendChild(link);
      }
      link.href = cfg.logoUrl;
    }
  };

  const fetchConfig = useCallback(async () => {
    try {
      const res = await api.get('/system/config');
      if (res.data) {
        setConfig(res.data);
        localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(res.data));
        applyBranding(res.data);
      }
    } catch (err) {
      console.error('Failed to load system config:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (config) {
      applyBranding(config);
    }
    fetchConfig();
  }, [fetchConfig]);

  const refreshConfig = async () => {
    await fetchConfig();
  };

  return (
    <SystemConfigContext.Provider value={{ config, loading, refreshConfig }}>
      {children}
    </SystemConfigContext.Provider>
  );
};

export const useSystemConfig = () => {
  const context = useContext(SystemConfigContext);
  if (!context) {
    throw new Error('useSystemConfig must be used within a SystemConfigProvider');
  }
  return context;
};
