/**
 * Runtime advisor authority for the AlphaB2B master app.
 *
 * The binary is built as AlphaQuark (`prod`), but an authenticated customer
 * can select another advisor by RA code. Post-login requests must therefore
 * prefer the selected advisor over build-time environment values even when a
 * helper cannot receive TradeContext.configData directly.
 */

const listeners = new Set();
let activeAdvisorConfig = null;

const configBody = value => value?.config || value || null;

export const getRuntimeAdvisorConfig = () => activeAdvisorConfig;

export const getRuntimeTenantSubdomain = () => {
  const config = configBody(activeAdvisorConfig);
  return (
    config?.REACT_APP_HEADER_NAME ||
    activeAdvisorConfig?.subdomain ||
    null
  );
};

export const getRuntimeAppVariant = () => {
  const config = configBody(activeAdvisorConfig);
  return config?.APP_VARIANT || null;
};

export const getRuntimeDesignVariant = () => {
  const config = configBody(activeAdvisorConfig);
  if (config?.DESIGN_VARIANT) return config.DESIGN_VARIANT;

  // Only explicitly approved, statically bundled mappings belong here.
  // Unknown advisors keep the default AlphaB2B presentation.
  if (config?.APP_VARIANT === 'moneyman') return 'moneyman_app';
  return null;
};

export const subscribeRuntimeAdvisor = listener => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

const publish = nextConfig => {
  activeAdvisorConfig = nextConfig;
  listeners.forEach(listener => listener(activeAdvisorConfig));
};

export const setRuntimeAdvisorConfig = configData => {
  if (!configData || typeof configData !== 'object') return;
  publish(configData);
};

export const clearRuntimeAdvisorConfig = () => publish(null);

export const hydrateRuntimeAdvisorConfig = async storage => {
  if (!storage?.getItem) return null;
  try {
    const stored = await storage.getItem('@app:advisorConfig');
    if (!stored) return null;
    const parsed = JSON.parse(stored);
    setRuntimeAdvisorConfig(parsed);
    return parsed;
  } catch (error) {
    console.warn('[runtimeAdvisor] Failed to restore advisor config:', error?.message);
    return null;
  }
};
