import server from "./serverConfig";
import Config from "react-native-config";
import { generateToken } from "./SecurityTokenManager";
import AsyncStorage from "@react-native-async-storage/async-storage";
import {getRuntimeAdvisorConfig} from './runtimeAdvisor';
import {getTenantSubdomain} from './variantHelper';



const whiteLabelText = Config.REACT_APP_ADVISOR_SPECIFIC_TAG;
export default async function fetchAdminData() {
  const runtimeConfig = getRuntimeAdvisorConfig()?.config;
  const advisorName =
    runtimeConfig?.REACT_APP_ADVISOR_SPECIFIC_TAG || whiteLabelText;
  const url = `${server.server.baseUrl}api/terms-conditions/${advisorName}`;

  try {
    // Send a GET request to fetch data
    const response = await fetch(url, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        "X-Advisor-Subdomain": getTenantSubdomain(),
        "aq-encrypted-key": generateToken(
          Config.REACT_APP_AQ_KEYS,
          Config.REACT_APP_AQ_SECRET
        ),
      },
    });

    // Check if the request was successful
    if (!response.ok) {
      throw new Error(`Failed to fetch data: ${response.statusText}`);
    }

    // Parse the JSON response
    const data = await response.json();
    console.log("data", data);

    return data; // Return the fetched data
  } catch (error) {
    console.error("Error fetching data:", error.message);
    return null; // Return null in case of an error
  }
}
