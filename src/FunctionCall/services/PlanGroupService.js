import axios from "axios";
import server from "../../utils/serverConfig";
import { generateToken } from "../../utils/SecurityTokenManager";
import Config from "react-native-config";
import { useTrade } from "../../screens/TradeContext";



/** Creates a plan group entity in the backend. */
export function createPlanGroup(name, advisorId, advisorEmail, plans) {
  const {configData}=useTrade();
  return axios
    .post(
      `${server.server.baseUrl}api/admin/plan-groups`,
      {
        name,
        advisorId,
        advisorEmail,
        plans,
      },
      {
        headers: {
          "Content-Type": "application/json",
          "X-Advisor-Subdomain": configData?.config?.REACT_APP_HEADER_NAME,
          "aq-encrypted-key": generateToken(
            Config.REACT_APP_AQ_KEYS,
            Config.REACT_APP_AQ_SECRET
          ),
        },
      }
    )
    .then((response) => response.data.data.planGroup);
}

/** Updates a plan group entity in the backend. */
export function updatePlanGroup(groupId, advisorId, advisorEmail, plans) {
  const {configData}=useTrade();
  return axios.put(
    `${server.server.baseUrl}api/admin/plan-groups/${groupId}`,
    {
      advisorId,
      advisorEmail,
      plans,
    },
    {
      headers: {
        "Content-Type": "application/json",
        "X-Advisor-Subdomain": configData?.config?.REACT_APP_HEADER_NAME,
        "aq-encrypted-key": generateToken(
          Config.REACT_APP_AQ_KEYS,
          Config.REACT_APP_AQ_SECRET
        ),
      },
    }
  );
}

/** Deletes a plan group entity in the backend. */
export function deletePlanGroup(groupId) {
  const {configData}=useTrade();
  return axios.delete(
    `${server.server.baseUrl}api/admin/plan-groups/${groupId}`,
    {
      headers: {
        "Content-Type": "application/json",
        "X-Advisor-Subdomain": configData?.config?.REACT_APP_HEADER_NAME,
        "aq-encrypted-key": generateToken(
          Config.REACT_APP_AQ_KEYS,
          Config.REACT_APP_AQ_SECRET
        ),
      },
    }
  );
}

/** Fetches a specific plan group given a groupId. */
export function getPlanGroup(groupId) {
  const {configData}=useTrade();
  return axios.get(`${server.server.baseUrl}api/admin/plan-groups/${groupId}`, {
    headers: {
      "Content-Type": "application/json",
      "X-Advisor-Subdomain": configData?.config?.REACT_APP_HEADER_NAME,
      "aq-encrypted-key": generateToken(
        Config.REACT_APP_AQ_KEYS,
        Config.REACT_APP_AQ_SECRET
      ),
    },
  });
}

/** Fetches all the plan groups corresponding to the provided advisor email. */
export function getAllPlanGroupsForAdvisor(advisorEmail) {
  const {configData}=useTrade();
  return axios.get(
    `${server.server.baseUrl}api/admin/plan-groups/search-by-advisor/${advisorEmail}`,
    {
      headers: {
        "Content-Type": "application/json",
        "X-Advisor-Subdomain": configData?.config?.REACT_APP_HEADER_NAME,
        "aq-encrypted-key": generateToken(
          Config.REACT_APP_AQ_KEYS,
          Config.REACT_APP_AQ_SECRET
        ),
      },
    }
  );
}
