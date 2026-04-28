import React, { useState } from "react";
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    ScrollView,
    Image,
    Modal,
    SafeAreaView,
    Platform,
} from "react-native";
import moment from "moment";
import axios from "axios";
import Config from "react-native-config";
import server from "../../utils/serverConfig";
import { generateToken } from "../../utils/SecurityTokenManager";
import { Linking } from "react-native";
import RNFS from "react-native-fs";
import Share from "react-native-share";
import { decode as atob } from "base-64";
import YoutubePlayer from 'react-native-youtube-iframe';
import { Video, Play, BookOpen, FileText, ArrowLeft, XIcon, Download, Clock, ChevronLeft } from "lucide-react-native";
import { useNavigation } from "@react-navigation/native";
import Toast from "react-native-toast-message";
import { WebView } from "react-native-webview";
import { useTrade } from "../../screens/TradeContext";
import LinkOpeningWeb from "../../screens/Home/NewsScreen/LinkOpeningWeb";
import FileViewer from 'react-native-file-viewer';
import LinearGradient from "react-native-linear-gradient";
import { useConfig } from "../../context/ConfigContext";

const KnowledgeHub = ({ type = "all", maxItems = 1, ...props }) => {
    const {configData}=useTrade();

    // Get dynamic gradient colors from config
    const config = useConfig();
    const gradient1 = config?.gradient1 || '#0076FB';
    const gradient2 = config?.gradient2 || '#002651';
    const mainColor = config?.mainColor || '#0056B7';
    const navigation = props.navigation || useNavigation();
    const { blogs, pdf, videos } = useTrade();
    const [activeTab, setActiveTab] = useState("Videos");
    const [selectedBlog, setSelectedBlog] = useState(null);

    const tabs = [
        { id: "Videos", label: "Videos", iconComponent: Video },
        { id: "Blogs", label: "Blogs", iconComponent: BookOpen },
        { id: "PDFs", label: "PDFs", iconComponent: FileText },
    ];

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
                fontFamily: "Poppins-Medium",
            },
            text2Style: {
                color: "black",
                fontSize: 12,
                fontFamily: "Poppins-Regular",
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
      background-color: #ffffff;
      color: #333;
    }
    h1 {
      color: #1a1a1a;
      font-size: 24px;
      margin-top: 0;
      margin-bottom: 16px;
      font-weight: 700;
      line-height: 1.3;
    }
    h2, h3, h4, h5, h6 {
      color: #2c3e50;
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
      color: #3498db;
      text-decoration: none;
      border-bottom: 1px solid rgba(52, 152, 219, 0.3);
      transition: border-color 0.2s;
    }
    a:hover {
      border-color: #3498db;
    }
    strong { font-weight: 600;}
    em { font-style: italic;}
    ol, ul { padding-left: 24px; margin-bottom: 20px;}
    li { margin-bottom: 10px;}
    blockquote {
      border-left: 4px solid #e0e0e0;
      padding-left: 16px;
      margin-left: 0;
      color: #555;
      font-style: italic;
    }
    code {
      background-color: #f5f5f5;
      padding: 2px 5px;
      border-radius: 3px;
      font-family: monospace;
    }
    pre {
      background-color: #f5f5f5;
      padding: 16px;
      border-radius: 8px;
      overflow-x: auto;
    }
    .blog-header {
      margin-bottom: 24px;
      padding-bottom: 16px;
      border-bottom: 1px solid #eaeaea;
    }
    .blog-description {
      color: #555;
      font-size: 15px;
      line-height: 1.6;
      margin-bottom: 12px;
      font-style: italic;
    }
    .blog-meta {
      color: #666;
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
                    : ''
                }
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
      background-color: #f8f9fa;
      color: #666;
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
      color: #333;
      font-size: 22px;
      margin-bottom: 16px;
    }
    p {
      margin-bottom: 20px;
      font-size: 16px;
    }
    .timestamp {
      font-size: 14px;
      color: #999;
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

    // Reusable Empty State component
    const EmptyState = ({ type }) => {
        const messages = {
            Videos: {
                title: "No Videos Available",
                subtitle: "New learning videos will appear here once added.",
                emoji: "🎥",
            },
            Blogs: {
                title: "No Blogs Available",
                subtitle: "Stay tuned! Blogs will show up here once published.",
                emoji: "✍️",
            },
            PDFs: {
                title: "No PDFs Available",
                subtitle: "Your documents will be available here once uploaded.",
                emoji: "📄",
            },
        };

        const { title, subtitle, emoji } = messages[type] || {};

        return (
            <LinearGradient
                colors={[gradient1, gradient2]}
                style={{
                    flex: 1,
                    alignItems: "center",
                    justifyContent: "center",
                    padding: 24,
                    marginVertical: 20,
                    marginHorizontal: 20,
                    borderRadius: 20,
                    overflow: "hidden",
                    width: "90%",
                    alignSelf: "center",
                }}
            >
                {/* Glow circles */}
                <View
                    style={{
                        position: "absolute",
                        top: -100,
                        right: -100,
                        width: 300,
                        height: 300,
                        borderRadius: 150,
                        backgroundColor: "rgba(255,255,255,0.12)",
                    }}
                />
                <View
                    style={{
                        position: "absolute",
                        bottom: -80,
                        left: -80,
                        width: 250,
                        height: 250,
                        borderRadius: 125,
                        backgroundColor: "rgba(255,255,255,0.08)",
                    }}
                />

                {/* Icon container */}
                <LinearGradient
                    colors={[gradient1, gradient2]}
                    style={{
                        width: 90,
                        height: 90,
                        borderRadius: 45,
                        justifyContent: "center",
                        alignItems: "center",
                        marginBottom: 20,
                        shadowColor: gradient2,
                        shadowOffset: { width: 0, height: 4 },
                        shadowOpacity: 0.25,
                        shadowRadius: 8,
                        elevation: 6,
                    }}
                >
                    <View
                        style={{
                            width: 70,
                            height: 70,
                            borderRadius: 35,
                            backgroundColor: "rgba(255,255,255,0.2)",
                            justifyContent: "center",
                            alignItems: "center",
                        }}
                    >
                        <View
                            style={{
                                width: 50,
                                height: 50,
                                borderRadius: 25,
                                backgroundColor: "rgba(255,255,255,0.85)",
                                justifyContent: "center",
                                alignItems: "center",
                            }}
                        >
                            <Text style={{ fontSize: 28 }}>{emoji}</Text>
                        </View>
                    </View>
                </LinearGradient>

                {/* Title */}
                <Text
                    style={{
                        fontFamily: "Satoshi-SemiBold",
                        fontSize: 18,
                        color: "white",
                        textAlign: "center",
                        marginBottom: 12,
                    }}
                >
                    {title}
                </Text>

                {/* Subtitle */}
                <Text
                    style={{
                        fontFamily: "Satoshi-Medium",
                        fontSize: 14,
                        color: "rgba(255,255,255,0.85)",
                        textAlign: "center",
                        maxWidth: "85%",
                        lineHeight: 20,
                        marginBottom: 12,
                    }}
                >
                    {subtitle}
                </Text>
            </LinearGradient>
        );
    };

    // --- NEW Video Card UX here ---
    const renderContentItem = (item, contentType) => {
        if (contentType === "Videos") {
            return (
                <TouchableOpacity
                    key={item._id || item.video_id}
                    style={styles.videoCard}
                    onPress={() => handleContentPress(item, contentType)}
                    activeOpacity={0.94}
                >
                    <View style={styles.thumbnailContainer}>
                        <Image source={{ uri: item.thumbnail_url }} style={styles.thumbnailImage} />
                        <View style={styles.playIconOverlay}>
                            <Play size={40} color="#fff" />
                        </View>
                    </View>
                    <View style={styles.videoInfo}>
                        <Text style={styles.videoTitle} numberOfLines={2}>
                            {item.title}
                        </Text>
                        <Text style={styles.videoDescription} numberOfLines={1}>
                            {item.description}
                        </Text>
                        <View style={styles.videoFooter}>
                            <TouchableOpacity>
                                <Text style={styles.watchVideoButton}>Watch Video →</Text>
                            </TouchableOpacity>
                            <View style={styles.durationBox}>
                                <Clock size={15} color="#6B7280" />
                                <Text style={styles.durationText}>
                                    {moment(item.created_at).fromNow()}  {/* shows "2 days ago" */}
                                </Text>
                            </View>
                        </View>
                    </View>
                </TouchableOpacity>
            );
        }
        if (contentType === "Blogs") {
            return (
                <TouchableOpacity
                    key={item._id || item.blog_id}
                    style={styles.blogCard}
                    onPress={() => handleContentPress(item, contentType)}
                    activeOpacity={0.94}
                >
                    <View style={styles.blogThumbnailContainer}>
                        <Image
                            source={{ uri: item.imageUrl || "https://via.placeholder.com/350x160" }}
                            style={styles.blogThumbnail}
                        />
                    </View>
                    <View style={styles.blogInfo}>
                        <Text style={styles.blogTitle} numberOfLines={2}>{item.title}</Text>
                        <Text style={styles.blogDescription} numberOfLines={2}>{item.description}</Text>
                        <View style={styles.blogFooter}>
                            <View style={styles.blogMeta}>
                                <BookOpen size={15} color="#6B7280" />
                                <Text style={styles.blogMetaText}>{item.readTime ? item.readTime + " min read" : "Read"}</Text>
                            </View>
                            <Text style={styles.blogReadMore}>Read More</Text>
                        </View>
                    </View>
                </TouchableOpacity>
            );
        }
        if (contentType === "PDFs") {
            return (
                <TouchableOpacity
                    key={item._id}
                    style={styles.pdfCard}
                    onPress={() => handleContentPress(item, contentType)}
                    activeOpacity={0.94}
                >
                    <View style={styles.pdfIconContainer}>
                        <Image
                            source={{ uri: "https://cdn-icons-png.flaticon.com/512/337/337946.png" }}
                            style={styles.pdfIcon}
                        />
                    </View>
                    <View style={styles.pdfInfo}>
                        <Text style={styles.pdfTitle} numberOfLines={2}>{item.title}</Text>
                        <Text style={styles.pdfDescription} numberOfLines={2}>{item.description}</Text>
                        <View style={styles.pdfFooter}>
                            <View style={styles.pdfMeta}>
                                <BookOpen size={14} color="#6B7280" style={{ marginRight: 2 }} />
                                <Text style={styles.pdfMetaText}>{formatFileSize(item.file_size)}</Text>
                            </View>
                            <Text style={styles.pdfView}>View PDF</Text>
                        </View>
                    </View>
                </TouchableOpacity>
            );
        }

    };

    const contentData = {
        Videos: videos || [],
        Blogs: blogs || [],
        PDFs: pdf || [],
    };

    const displayContent =
        type === "home"
            ? contentData[activeTab]?.slice(0, maxItems)
            : contentData[activeTab];

    return (
        <View style={styles.container}>
            <View>
                <View style={styles.headerouter}>
                    {type === "home" && (
                        <View>
                            <Text style={styles.sectionTitle}>Knowledge Hub</Text>
                            <Text style={styles.sectionSubtitle}>
                                Learn with trusted advisor content.
                            </Text>
                        </View>
                    )}
                    {type === "home" && (
                        <TouchableOpacity
                            onPress={handleViewAllPress}
                            style={styles.viewAllButton}
                        >
                            <Text style={styles.viewAllText}>View All</Text>
                        </TouchableOpacity>
                    )}
                </View>
                <View style={styles.header}>

                    {type === "home" && (
                        <View style={{ flexDirection: 'row', paddingVertical: 5, }}>
                            {tabs.map((tab) => {
                                const IconComponent = tab.iconComponent;
                                return (
                                    <TouchableOpacity
                                        key={tab.id}
                                        style={[styles.tabouter, activeTab === tab.id && { backgroundColor: mainColor, borderColor: mainColor }]}
                                        onPress={() => handleTabPress(tab.id)}
                                    >
                                        <IconComponent
                                            size={14}
                                            color={activeTab === tab.id ? "#FFFFFF" : mainColor}
                                            style={styles.tabIconStyleouter}
                                        />
                                        <Text
                                            style={[
                                                styles.tabTextouter,
                                                { color: mainColor },
                                                activeTab === tab.id && styles.activeTabTextouter,
                                            ]}
                                        >
                                            {tab.label}
                                        </Text>
                                    </TouchableOpacity>
                                );
                            })}
                        </View>
                    )}
                </View>
            </View>

            {!(type === "home") && (
                <LinearGradient
                    colors={[gradient1, gradient2]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 0, y: 1 }}
                    style={{ paddingHorizontal: 15, paddingTop: 10, borderBottomLeftRadius: 0, borderBottomRightRadius: 0, marginBottom: 10, }}
                >
                    <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 10, }}>
                        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
                            <ChevronLeft size={24} color="#000" />
                        </TouchableOpacity>
                        <View style={{ justifyContent: 'center' }}>
                            <Text style={{ fontSize: 20, fontFamily: 'Poppins-Medium', color: '#fff' }}>
                                Knowledge Hub
                            </Text>
                        </View>
                    </View>
                    <View style={{ marginLeft: 45, marginTop: 2 }}>
                        <Text style={{ fontSize: 12, fontFamily: 'Poppins-Regular', color: '#f0f0f0' }}>
                            Learn with trusted advisor content.
                        </Text>
                    </View>
                    <View style={styles.tabContainer}>
                        {tabs.map((tab) => {
                            const IconComponent = tab.iconComponent;
                            return (
                                <TouchableOpacity
                                    key={tab.id}
                                    style={[styles.tab, activeTab === tab.id && { backgroundColor: mainColor, borderColor: mainColor }]}
                                    onPress={() => handleTabPress(tab.id)}
                                >
                                    <IconComponent
                                        size={16}
                                        color={activeTab === tab.id ? "#FFFFFF" : "#fff"}
                                        style={styles.tabIconStyle}
                                    />
                                    <Text
                                        style={[
                                            styles.tabText,
                                            activeTab === tab.id && styles.activeTabText,
                                        ]}
                                    >
                                        {tab.label}
                                    </Text>
                                </TouchableOpacity>
                            );
                        })}
                    </View>
                </LinearGradient>
            )}




            <SafeAreaView style={{ flex: 0, paddingHorizontal: 20, }}>
                <ScrollView
                    contentContainerStyle={{
                        paddingBottom: type === "home" ? 0 : 200, // extra space only for View All
                    }}

                    showsVerticalScrollIndicator={false}
                >
{displayContent.length > 0 ? (
  displayContent.map((item) => renderContentItem(item, activeTab))
) : (
  <EmptyState type={activeTab} />
)}

                </ScrollView>
            </SafeAreaView>


            <LinkOpeningWeb
                symbol={title}
                setWebview={setModalVisible}
                webViewVisible={modalVisible}
                currentUrl={currentUrl}
            />

            {selectedVideo && (
                <Modal
                    visible={videoModalVisible}
                    transparent={true}
                    animationType="fade"
                    onRequestClose={() => {
                        setVideoModalVisible(false);
                        setSelectedVideo(null);
                    }}
                >
                    <View style={styles.videoModalBackground}>
                        <View style={styles.videoModalContent}>
                            <View style={styles.videoModalHeader}>
                                <Text style={styles.videoModalTitle} numberOfLines={1}>
                                    {selectedVideo.title}
                                </Text>
                                <TouchableOpacity
                                    onPress={() => {
                                        setVideoModalVisible(false);
                                        setSelectedVideo(null);
                                    }}
                                >
                                    <XIcon size={20} color="#fff" />
                                </TouchableOpacity>
                            </View>
                            <YoutubePlayer height={250} play={true} videoId={selectedVideo.video_id} onChangeState={onStateChange} />
                        </View>
                    </View>
                </Modal>
            )}
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        backgroundColor: "transparent",
        paddingVertical: 0,
        paddingHorizontal: 0,
    },
    header: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        paddingHorizontal: 20,

    },
    headerouter: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        paddingHorizontal: 20,
        marginTop: 0,

    },
    backButton: { padding: 4, borderRadius: 5, backgroundColor: '#fff', marginRight: 10 },
    sectionTitle: {
        fontSize: 18,
        fontWeight: "600",
        color: "#1A1A1A",
        fontFamily: "Poppins-SemiBold",
        marginBottom: 4,
    },
    sectionSubtitle: {
        fontSize: 10,
        color: "#959595",
        fontFamily: "Poppins-Regular",
    },
    viewAllButton: {
        borderWidth: 1,
        borderRadius: 3,
        borderColor: "#1F7AE0",
        paddingHorizontal: 16,
        paddingVertical: 4,
    },
    viewAllText: {
        fontSize: 10,
        color: "#1F7AE0",
        fontFamily: "Poppins-Medium",
    },
    tabContainer: {
        flexDirection: "row",
        borderRadius: 12,
        paddingHorizontal: 10,

    },
    tab: {
        flex: 1,
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        paddingVertical: 8,
        paddingHorizontal: 8,
        borderRadius: 3,
        marginTop: 10,
        marginHorizontal: 2,
    },
    activeTab: {
        backgroundColor: "#0056B7",
        borderColor: "#0056B7",
    },
    tabIconStyle: {
        marginRight: 6,
    },
    tabText: {
        fontSize: 14,
        fontFamily: "Poppins-Medium",
        color: "#fff",
    },
    activeTabText: {
        color: "#FFFFFF",
    },

    //
    tabouter: {
        flex: 1,
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        paddingVertical: 8,
        paddingHorizontal: 8,
        borderRadius: 3,
        marginTop: 5,
        backgroundColor: '#fff',
        marginHorizontal: 2,
    },
    activeTabouter: {
        backgroundColor: "#0056B7",
        borderColor: "#0056B7",
    },
    tabIconStyleouter: {
        marginRight: 6,
    },
    tabTextouter: {
        fontSize: 12,
        fontFamily: "Poppins-Medium",
        color: "#0056B7",
    },
    activeTabTextouter: {
        color: "#FFFFFF",
    },
    contentContainer: {

    },

    // ----------- NEW Video Card Styles --------------
    videoCard: {
        backgroundColor: "#fff",
        borderRadius: 10,
        overflow: "hidden",
        marginBottom: 22,
        borderWidth: 1,
        borderColor: "#E5E7EB",
        shadowColor: "#111",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.09,
        shadowRadius: 8,
        elevation: 2,
    },
    thumbnailContainer: {
        width: "100%",
        height: 120,
        position: "relative",
        backgroundColor: "#F3F4F6",
        overflow: "hidden",
        borderTopLeftRadius: 8,
        borderTopRightRadius: 8,
    },
    thumbnailImage: {
        width: "100%",
        height: "100%",
        resizeMode: "cover",
    },
    playIconOverlay: {
        position: "absolute",
        top: "50%",
        left: "50%",
        transform: [{ translateX: -18 }, { translateY: -18 }],
        backgroundColor: "rgba(0,0,0,0.32)",
        borderRadius: 30,
        padding: 7,
        justifyContent: "center",
        alignItems: "center",
    },
    videoInfo: {
        paddingHorizontal: 16,
        paddingBottom: 16,
        paddingTop: 12,
    },
    videoTitle: {
        fontSize: 15,
        fontWeight: "bold",
        color: "#222",
        fontFamily: "Poppins-SemiBold",
        marginBottom: 4,
    },
    videoDescription: {
        fontSize: 12,
        color: "#555",
        fontFamily: "Poppins-Regular",
        marginBottom: 6,
    },
    videoFooter: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        marginTop: 2,
    },
    watchVideoButton: {
        fontSize: 13,
        color: "#1F7AE0",
        fontFamily: "Poppins-Medium",
        paddingVertical: 2,
    },
    durationBox: {
        flexDirection: "row",
        alignItems: "center",
        backgroundColor: "#F1F5F9",
        borderRadius: 7,
        paddingHorizontal: 8,
        paddingVertical: 3,
    },
    durationText: {
        fontSize: 11,
        color: "#6B7280",
        fontFamily: "Poppins-Regular",
        marginLeft: 5,
    },
    // ------------ End NEW Video Card Styles -----------

    contentItem: {
        flexDirection: "row",
        backgroundColor: "#FFFFFF",
        borderRadius: 12,
        padding: 12,
        marginBottom: 12,
        borderWidth: 1,
        borderColor: "#E5E7EB",
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 4,
        elevation: 2,
    },
    thumbnail: {
        width: 120,
        height: 80,
        borderRadius: 8,
        backgroundColor: "#F3F4F6",
    },
    contentInfo: {
        flex: 1,
        marginLeft: 12,
    },
    contentTitle: {
        fontSize: 14,
        fontWeight: "600",
        color: "#1F2937",
        fontFamily: "Poppins-SemiBold",
        marginBottom: 4,
    },
    contentDescription: {
        fontSize: 12,
        color: "#6B7280",
        fontFamily: "Poppins-Regular",
        lineHeight: 16,
        marginBottom: 8,
    },
    contentMeta: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
    },
    metaText: {
        fontSize: 11,
        color: "#9CA3AF",
        fontFamily: "Poppins-Regular",
    },
    watchButton: {
        fontSize: 11,
        color: "#4A6CF7",
        fontFamily: "Poppins-Medium",
    },
    modalHeader: {
        flexDirection: "row",
        alignItems: "center",
        padding: 12,
        borderBottomWidth: 1,
        borderBottomColor: "#E5E7EB",
    },
    modalTitle: {
        fontSize: 16,
        fontFamily: "Poppins-SemiBold",
        color: "#111",
    },
    videoModalBackground: {
        flex: 1,
        backgroundColor: "rgba(0, 0, 0, 0.8)",
        justifyContent: "center",
        alignItems: "center",
    },
    videoModalContent: {
        width: "90%",
        backgroundColor: "#000",
        borderRadius: 12,
        overflow: "hidden",
    },
    videoModalHeader: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        padding: 15,
        backgroundColor: "#111",
    },
    videoModalTitle: {
        color: "#fff",
        fontFamily: "Satoshi-Bold",
        fontSize: 16,
        flex: 1,
        marginRight: 10,
    },
    blogCard: {
        backgroundColor: "#fff",
        borderRadius: 10,
        overflow: "hidden",
        marginBottom: 22,
        borderWidth: 1,
        borderColor: "#E5E7EB",
        shadowColor: "#111",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.09,
        shadowRadius: 8,
        elevation: 2,
    },
    blogThumbnailContainer: {
        width: "100%",
        height: 120,
        backgroundColor: "#EEF2F6",
        overflow: "hidden",
        borderTopLeftRadius: 8,
        borderTopRightRadius: 8,
    },
    blogThumbnail: {
        width: "100%",
        height: "100%",
        resizeMode: "cover",
    },
    blogInfo: {
        paddingHorizontal: 16,
        paddingBottom: 14,
        paddingTop: 12,
    },
    blogTitle: {
        fontSize: 15,
        fontWeight: "bold",
        color: "#212121",
        fontFamily: "Poppins-SemiBold",
        marginBottom: 4,
    },
    blogDescription: {
        fontSize: 12,
        color: "#555",
        fontFamily: "Poppins-Regular",
        marginBottom: 6,
    },
    blogFooter: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        marginTop: 2,
    },
    blogMeta: {
        flexDirection: "row",
        alignItems: "center",
    },
    blogMetaText: {
        marginLeft: 4,
        fontSize: 11,
        color: "#6B7280",
        fontFamily: "Poppins-Regular",
    },
    blogReadMore: {
        fontSize: 13,
        color: "#1F7AE0",
        fontFamily: "Poppins-Medium",
    },

    pdfCard: {
        backgroundColor: "#fff",
        borderRadius: 10,
        overflow: "hidden",
        marginBottom: 22,
        borderWidth: 1,
        borderColor: "#E5E7EB",
        shadowColor: "#111",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.09,
        shadowRadius: 8,
        elevation: 2,
        alignItems: "center",
        paddingBottom: 13,
    },
    pdfIconContainer: {
        width: "100%",
        alignItems: "center",
        backgroundColor: "#F7F7FA",
        paddingVertical: 20,
    },
    pdfIcon: {
        width: 52,
        height: 52,
        borderRadius: 0,
        backgroundColor: "#F7F7FA",
    },
    pdfInfo: {
        width: "100%",
        paddingHorizontal: 18,
        paddingTop: 10,
    },
    pdfTitle: {
        fontSize: 15,
        fontWeight: "bold",
        color: "#353535",
        fontFamily: "Poppins-SemiBold",
        marginBottom: 4,
    },
    pdfDescription: {
        fontSize: 12,
        color: "#666",
        fontFamily: "Poppins-Regular",
        marginBottom: 6,
    },
    pdfFooter: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        marginTop: 2,
    },
    pdfMeta: {
        flexDirection: "row",
        alignItems: "center",
    },
    pdfMetaText: {
        marginLeft: 3,
        fontSize: 11,
        color: "#6B7280",
        fontFamily: "Poppins-Regular",
    },
    pdfView: {
        fontSize: 13,
        color: "#1F7AE0",
        fontFamily: "Poppins-Medium",
    },

});

export default KnowledgeHub;
