import React, { createContext, useContext, useState, useEffect } from 'react';
import { fetchGstConfig, getEnvFallbackConfig } from '../services/GstConfigService';

const defaultContextValue = {
  gstConfigure: false,
  gstWithTextConfigure: false,
  isLoading: true,
};

const GstConfigContext = createContext(defaultContextValue);

export function GstConfigProvider({ children }) {
  const [state, setState] = useState(defaultContextValue);

  useEffect(() => {
    let isMounted = true;

    async function loadConfig() {
      try {
        console.log('[GstConfigContext] Fetching GST configuration...');
        const config = await fetchGstConfig();

        if (isMounted) {
          console.log('✅ GST Config loaded:', {
            gstConfigure: config.gstConfigure,
            gstWithTextConfigure: config.gstWithTextConfigure
          });
          setState({
            gstConfigure: config.gstConfigure,
            gstWithTextConfigure: config.gstWithTextConfigure,
            isLoading: false,
          });
        }
      } catch (error) {
        console.error('[GstConfigContext] Failed to load config:', error);
        if (isMounted) {
          const fallback = getEnvFallbackConfig();
          console.log('⚠️ Using GST fallback config:', fallback);
          setState({
            ...fallback,
            isLoading: false,
          });
        }
      }
    }

    loadConfig();

    return () => {
      isMounted = false;
    };
  }, []);

  return (
    <GstConfigContext.Provider value={state}>
      {children}
    </GstConfigContext.Provider>
  );
}

export function useGstConfig() {
  const context = useContext(GstConfigContext);

  if (context === undefined) {
    throw new Error('useGstConfig must be used within a GstConfigProvider');
  }

  return context;
}

export default GstConfigContext;
