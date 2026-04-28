import {useQuery, useQueryClient} from 'react-query';
import axios from 'axios';
import server from './serverConfig';
import {getAdvisorSubdomain} from './variantHelper';
// Fetch user data
const fetchUser = async ({queryKey}) => {
  const heroId = queryKey[1];
  const response = await axios.get(
    `${server.server.baseUrl}api/user/getUser/${heroId}`,
    {
      headers: {
        'Content-Type': 'application/json',
        'X-Advisor-Subdomain': getAdvisorSubdomain(),
        'aq-encrypted-key': generateToken(
          Config.REACT_APP_AQ_KEYS,
          Config.REACT_APP_AQ_SECRET,
        ),
      },
    },
  );
  return response.data;
};

export const useCurrentUserData = heroId => {
  const queryClient = useQueryClient();
  return useQuery(['userHero', heroId], fetchUser, {
    initialData: () => {
      const data = queryClient
        .getQueryData('user-heroes')
        ?.data?.find(item => item.id === parseInt(heroId));
      if (data) {
        return {data: data};
      } else {
        return undefined;
      }
    },
  });
};

// Fetch all CSV files for a particular admin
const fetchAllCsvFile = async ({queryKey}) => {
  const heroId = queryKey[1];
  const response = await axios.get(
    `${server.server.baseUrl}api/csv-upload/${heroId}`,
    {
      headers: {
        'Content-Type': 'application/json',
        'X-Advisor-Subdomain': Config.REACT_APP_HEADER_NAME,
        'aq-encrypted-key': generateToken(
          Config.REACT_APP_AQ_KEYS,
          Config.REACT_APP_AQ_SECRET,
        ),
      },
    },
  );
  return response.data;
};

export const useCurrentAdminAllCsvFileData = heroId => {
  const queryClient = useQueryClient();
  return useQuery(['allCsvFile', heroId], fetchAllCsvFile, {
    initialData: () => {
      const data = queryClient
        .getQueryData('user-heroes')
        ?.data?.find(item => item.id === parseInt(heroId));
      if (data) {
        return {data: data};
      } else {
        return undefined;
      }
    },
  });
};
