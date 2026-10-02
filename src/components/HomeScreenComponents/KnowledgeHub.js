import React, { useState } from "react";
import {Linking, Platform} from 'react-native';
import moment from 'moment';
import axios from 'axios';
import Config from 'react-native-config';
import RNFS from 'react-native-fs';
import {decode as atob} from 'base-64';
import { useNavigation } from "@react-navigation/native";
import Toast from "react-native-toast-message";
import { useTrade } from "../../screens/TradeContext";
import LinkOpeningWeb from "../../screens/Home/NewsScreen/LinkOpeningWeb";
import FileViewer from 'react-native-file-viewer';
import { useConfig } from "../../context/ConfigContext";
import {getAdvisorContentProfile} from '../../utils/advisorContentProfile';
import server from '../../utils/serverConfig';
import {generateToken} from '../../utils/SecurityTokenManager';

import {designColor, designFont} from '../../design/literalTokens';
import {useComponent} from '../../design/useDesign';

// Classify a video from /misc/videos: youtube | vimeo | direct (mp4/webm).
// Older rows carry no video_type → default to youtube.
const KnowledgeHub = ({ type = "all", maxItems = 1, ...props }) => {
    const advisorContent = getAdvisorContentProfile();
    const navigationHook = useNavigation();
    const {configData}=useTrade();

    // Get dynamic gradient colors from config
    const config = useConfig();
    const gradient1 = config?.gradient1 || designColor('0076fb');
    const gradient2 = config?.gradient2 || designColor('002651');
    const mainColor = config?.mainColor || designColor('0056b7');
    const navigation = props.navigation || navigationHook;
    const { blogs, pdf, videos } = useTrade();
    const [activeTab, setActiveTab] = useState("Videos");
    const [selectedBlog, setSelectedBlog] = useState(null);


    const convertToTimeAgo = (dateString) => {
        return moment(dateString).fromNow();
    };
    const handleTabPress = (tabId) => setActiveTab(tabId);

    const handleViewAllPress = () => {
        switch (activeTab) {
            case "Videos":
                navigation.navigate("VideosScreen", { videos });
                break;
            case "Blogs":
                navigation.navigate("BlogsScreen", { blogs });
                break;
            case "PDFs":
                navigation.navigate("PDFsScreen", { pdfs: pdf });
                break;
        }
    };

    const [modalVisible, setModalVisible] = useState(false);
    const [currentUrl, setCurrentUrl] = useState("");
    const [loading, setLoading] = useState(false);
    const [title, settitle] = useState("");

    const [selectedVideoId, setSelectedVideoId] = useState(null);
    const [selectedVideo, setSelectedVideo] = useState(null);
    const [videoModalVisible, setVideoModalVisible] = useState(false);
    const onStateChange = (state) => {
        if (state === 'ended') {
            setSelectedVideo(null);
        }
    };

    const [isLoading, setIsLoading] = useState(false);

    const formatFileSize = (bytes) => {
        if (!bytes) return "Unknown size";
        const mb = bytes / (1024 * 1024);
        if (mb < 1) {
            const kb = bytes / 1024;
            return `${kb.toFixed(0)} KB`;
        }
        return `${mb.toFixed(1)} MB`;
    };

    const showToast = (message1, type, message2) => {
        Toast.show({
            type: type,
            text2: message2 + " " + message1,
            position: "bottom",
            text1Style: {
                color: "black",
                fontSize: 11,
                fontWeight: 0,
                fontFamily: designFont('Poppins-Medium'),
            },
            text2Style: {
                color: "black",
                fontSize: 12,
                fontFamily: designFont('Poppins-Regular'),
            },
        });
    };

    const handleDownload = async (pdfID) => {
        setIsLoading(true);
        try {
            const response = await axios.get(`${server.ccxtServer.baseUrl}/misc/pdfs/download/${pdfID}`, {
                headers: {
                    "Content-Type": "application/json",
                    "X-Advisor-Subdomain":  configData?.config?.REACT_APP_HEADER_NAME,
                    "aq-encrypted-key": generateToken(Config.REACT_APP_AQ_KEYS, Config.REACT_APP_AQ_SECRET),
                },
            });

            if (response.data && response.data.pdf_data) {
                await completeDownloadStatement(response.data.pdf_data);
            } else {
                showToast("PDF data not found", "error", "");
            }
        } catch (error) {
            console.error("Error downloading PDF:", error);
            showToast("Failed to download PDF", "error", "");
        } finally {
            setIsLoading(false);
        }
    };

    const completeDownloadStatement = async (pdfData) => {
        try {
            if (pdfData) {
                const fileName = `Account_statement_${new Date().getTime()}.pdf`;
                const path =
                    Platform.OS === "android"
                        ? `${RNFS.DownloadDirectoryPath}/${fileName}`
                        : `${RNFS.DocumentDirectoryPath}/${fileName}`;
                const binaryData = atob(pdfData);
                await RNFS.writeFile(path, binaryData, "ascii");
                const fileExists = await RNFS.exists(path);
                if (fileExists) {
                    showToast("File successfully saved in download folder", "success", "");
                    FileViewer.open(path)
                        .then(() => console.log("PDF opened successfully"))
                        .catch((err) => {
                            console.error("Error opening PDF:", err);
                            showToast("Could not open PDF", "error", "");
                        });
                } else {
                    console.error("File not found after saving:", path);
                    showToast("Failed to save PDF", "error", "");
                }
            } else {
                console.error("PDF data is empty");
                showToast("PDF data is empty", "error", "");
            }
        } catch (error) {
            console.error("Error saving PDF:", error);
            showToast("Error downloading PDF", "error", "");
        }
    };

    const handleViewPDF = async (pdfID) => {
        setIsLoading(true);
        try {
            const response = await axios.get(`${server.ccxtServer.baseUrl}/misc/pdfs/download/${pdfID}`, {
                headers: {
                    "Content-Type": "application/json",
                    "X-Advisor-Subdomain":  configData?.config?.REACT_APP_HEADER_NAME,
                    "aq-encrypted-key": generateToken(Config.REACT_APP_AQ_KEYS, Config.REACT_APP_AQ_SECRET),
                },
            });

            if (response.data && response.data.pdf_data) {
                const fileName = `pdf_${new Date().getTime()}.pdf`;
                const path =
                    Platform.OS === "android"
                        ? `${RNFS.CachesDirectoryPath}/${fileName}`
                        : `${RNFS.DocumentDirectoryPath}/${fileName}`;

                const binaryData = atob(response.data.pdf_data);
                await RNFS.writeFile(path, binaryData, "ascii");
                FileViewer.open(path)
                    .then(() => {
                        console.log("Opened PDF successfully");
                    })
                    .catch((err) => {
                        console.error("Error opening PDF:", err);
                        showToast("Could not open PDF", "error", "");
                    });
            } else {
                showToast("PDF data not found", "error", "");
            }
        } catch (error) {
            console.error("Error viewing PDF:", error);
            showToast("Failed to open PDF", "error", "");
        } finally {
            setIsLoading(false);
        }
    };

    const openWebView = (item) => {
        if (item.content && item.content.trim().length > 0) {
            const htmlContent = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      line-height: 1.8;
      margin: 0;
      padding: 20px;
      background-color: ${designColor('ffffff')};
      color: ${designColor('333')};
    }
    h1 {
      color: ${designColor('1a1a1a')};
      font-size: 24px;
      margin-top: 0;
      margin-bottom: 16px;
      font-weight: 700;
      line-height: 1.3;
    }
    h2, h3, h4, h5, h6 {
      color: ${designColor('2c3e50')};
      margin-top: 28px;
      margin-bottom: 16px;
      font-weight: 600;
    }
    p {
      margin-bottom: 20px;
      font-size: 16px;
    }
    img {
      max-width: 100%;
      height: auto;
      border-radius: 8px;
      margin: 20px 0;
      box-shadow: 0 4px 8px rgba(0,0,0,0.1);
    }
    .ql-video {
      width: 100%;
      height: 220px;
      border-radius: 8px;
      margin: 20px 0;
    }
    a {
      color: ${designColor('3498db')};
      text-decoration: none;
      border-bottom: 1px solid rgba(52, 152, 219, 0.3);
      transition: border-color 0.2s;
    }
    a:hover {
      border-color: ${designColor('3498db')};
    }
    strong { font-weight: 600;}
    em { font-style: italic;}
    ol, ul { padding-left: 24px; margin-bottom: 20px;}
    li { margin-bottom: 10px;}
    blockquote {
      border-left: 4px solid ${designColor('e0e0e0')};
      padding-left: 16px;
      margin-left: 0;
      color: ${designColor('555')};
      font-style: italic;
    }
    code {
      background-color: ${designColor('f5f5f5')};
      padding: 2px 5px;
      border-radius: 3px;
      font-family: monospace;
    }
    pre {
      background-color: ${designColor('f5f5f5')};
      padding: 16px;
      border-radius: 8px;
      overflow-x: auto;
    }
    .blog-header {
      margin-bottom: 24px;
      padding-bottom: 16px;
      border-bottom: 1px solid ${designColor('eaeaea')};
    }
    .blog-description {
      color: ${designColor('555')};
      font-size: 15px;
      line-height: 1.6;
      margin-bottom: 12px;
      font-style: italic;
    }
    .blog-meta {
      color: ${designColor('666')};
      font-size: 14px;
      margin-bottom: 24px;
      display: flex;
      align-items: center;
    }
    .blog-meta svg {
      margin-right: 6px;
    }
    .blog-content {
      line-height: 1.8;
    }
  </style>
</head>
<body>
  <div class="blog-header">
    ${item.description ? `<p class="blog-description">${item.description}</p>` : ''}
    <div class="blog-meta">
      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10"></circle>
        <polyline points="12 6 12 12 16 14"></polyline>
      </svg>
      ${convertToTimeAgo(item.created_at)}
    </div>
  </div>
  <div>
   ${item.imageUrl
        ? `<img src="${item.imageUrl}" alt="${item.title}" />`
        : ''}
  </div>
  <div class="blog-content">
    ${item.content}
  </div>
</body>
</html>
      `;
            const dataUrl = `data:text/html;charset=utf-8,${encodeURIComponent(htmlContent)}`;
            setCurrentUrl(dataUrl);
        } else if (item.link || item.videoUrl) {
            setCurrentUrl(item.link || item.videoUrl);
        } else {
            const noContentHtml = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      text-align: center;
      padding: 40px 20px;
      background-color: ${designColor('f8f9fa')};
      color: ${designColor('666')};
      line-height: 1.6;
    }
    .message {
      background: white;
      padding: 40px 30px;
      border-radius: 16px;
      box-shadow: 0 4px 20px rgba(0,0,0,0.08);
      max-width: 500px;
      margin: 0 auto;
    }
    h2 {
      color: ${designColor('333')};
      font-size: 22px;
      margin-bottom: 16px;
    }
    p {
      margin-bottom: 20px;
      font-size: 16px;
    }
    .timestamp {
      font-size: 14px;
      color: ${designColor('999')};
      margin-top: 20px;
    }
    .icon {
      font-size: 48px;
      margin-bottom: 20px;
    }
  </style>
</head>
<body>
  <div class="message">
    <div class="icon">📄</div>
    <h2>${item.title}</h2>
    <p>Content is not available for this blog post.</p>
    <p class="timestamp">Published ${convertToTimeAgo(item.created_at)}</p>
  </div>
</body>
</html>
      `;
            setCurrentUrl(`data:text/html;charset=utf-8,${encodeURIComponent(noContentHtml)}`);
        }
        settitle(item.title);
        setModalVisible(true);
    };

    const handleContentPress = (item, contentType) => {
        if (contentType === "Videos") {
            setSelectedVideoId(item?.video_id);
            setVideoModalVisible(true);
            setSelectedVideo(item);
        } else if (contentType === "Blogs") {
            openWebView(item);
        } else if (contentType === "PDFs") {
            handleViewPDF(item?._id);
        }
    };

    const Presentation = useComponent('screens.KnowledgeHub');
    const handleOpenInsights = () => {
        if (!advisorContent.insightsUrl) return;
        Linking.openURL(advisorContent.insightsUrl).catch(error =>
            console.warn('[KnowledgeHub] Unable to open insights link:', error?.message),
        );
    };
    return (
        <Presentation
            viewModel={{
                type, maxItems, gradient1, gradient2, mainColor, activeTab,
                videos, blogs, pdf, modalVisible, title, currentUrl,
                selectedVideo, videoModalVisible, insightsUrl: advisorContent.insightsUrl,
            }}
            actions={{
                handleViewAllPress, handleTabPress, handleContentPress,
                setModalVisible, setVideoModalVisible, setSelectedVideo,
                onStateChange, formatFileSize,
                onBack: () => navigation.goBack(),
                onOpenInsights: handleOpenInsights,
            }}
            slots={{WebLink: LinkOpeningWeb}}
        />
    );
};

export default KnowledgeHub;
