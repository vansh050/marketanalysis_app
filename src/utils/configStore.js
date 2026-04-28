let configDataStore = null;

export const setConfigData = (data) => {
  configDataStore = data;
};

export const getConfigData = () => configDataStore;
