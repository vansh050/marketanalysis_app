// ConfigContext.js
import React, {createContext, useState, useContext, useEffect} from 'react';
import Config from 'react-native-config';
import axios from 'axios';
import server from '../utils/serverConfig';
import {generateToken} from '../utils/SecurityTokenManager';

const ConfigContext = createContext();

export const useConfig = () => {
  return useContext(ConfigContext);
};

export const ConfigProvider = ({children}) => {
  const [advisorDetails, setAdvisorDetails] = useState(null);
  const [appConfig, setAppConfig] = useState({
    advisorName: Config.REACT_APP_URL || 'defaultAdvisor',
    baseUrl: server.server.baseUrl,
    themeColor: '#0056B7',
  });
  const [loading, setLoading] = useState(true);

  const fetchAdvisorConfig = async () => {
    try {
      setLoading(true);
      const token = generateToken(
        Config.REACT_APP_AQ_KEYS,
        Config.REACT_APP_AQ_SECRET,
      );
      const res = await axios.get(
        `${server.server.baseUrl}api/advisor-config-env/getConfig/${Config?.ADVISOR_RA_CODE}`,
        {
          headers: {
            'Content-Type': 'application/json',
            'X-Advisor-Subdomain': 'common',
            'aq-encrypted-key': token,
          },
        },
      );

      const data = res.data?.advisor || {};
      setAdvisorDetails(data);
      // console.log('res config here--------======-', res);
    } catch (error) {
      // console.error('Error fetching advisor config-------:', error.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAdvisorConfig();
  }, []);

  return (
    <ConfigContext.Provider value={{advisorDetails, appConfig, loading}}>
      {children}
    </ConfigContext.Provider>
  );
};
