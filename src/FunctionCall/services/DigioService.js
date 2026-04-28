import axios from "axios";
import server from "../../utils/serverConfig";

import { encryptApiKey } from "../utils/cryptoUtils";
import Config from "react-native-config";
import { generateToken } from "../../utils/SecurityTokenManager";
import { useTrade } from "../../screens/TradeContext";



const DigioService = {
  async uploadPdf(mobileNumber) {
      const {configData}=useTrade();
      const advisorTag = configData?.config?.REACT_APP_ADVISOR_SPECIFIC_TAG;
    try {
      const response = await fetch("/digio.pdf");
      const blob = await response.blob();
      const file = new File([blob], "digio.pdf", { type: "application/pdf" });

      const formData = new FormData();
      formData.append("file", file);

      const res = await axios.post(
        `${server.ccxtServer.baseUrl}misc/digio/upload/pdf/${mobileNumber}/${advisorTag}`,
        formData,
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

      return res.data;
    } catch (error) {
      console.error("Error uploading PDF:", error);
      throw error;
    }
  },

  async getDocumentDetails(documentId) {
      const {configData}=useTrade();
      const advisorTag = configData?.config?.REACT_APP_ADVISOR_SPECIFIC_TAG;
    try {
      const res = await axios.get(
        `${server.ccxtServer.baseUrl}misc/digio/doc-detail/${documentId}/${advisorTag}`,
        {
          headers: {
            "X-Advisor-Subdomain": configData?.config?.REACT_APP_HEADER_NAME,
            "aq-encrypted-key": generateToken(
              Config.REACT_APP_AQ_KEYS,
              Config.REACT_APP_AQ_SECRET
            ),
          },
        }
      );
      return res.data;
    } catch (error) {
      console.error("Error fetching document details:", error);
      throw error;
    }
  },

  async downloadSignedDocument(documentId) {
      const {configData}=useTrade();
      const advisorTag = configData?.config?.REACT_APP_ADVISOR_SPECIFIC_TAG;
    try {
      const response = await axios.get(
        `${server.ccxtServer.baseUrl}misc/digio/download/signed-doc/${documentId}/${advisorTag}`,
        { responseType: "blob" },
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

      const pdfBlob = new Blob([response.data], { type: "application/pdf" });
      const pdfUrl = URL.createObjectURL(pdfBlob);
      const link = document.createElement("a");
      link.href = pdfUrl;
      link.setAttribute("download", "signed-document.pdf");
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(pdfUrl);
    } catch (error) {
      console.error("Error downloading signed document:", error);
      throw error;
    }
  },
};

export default DigioService;
