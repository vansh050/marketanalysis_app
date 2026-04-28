"use client"

import { useState } from "react"
import { View, Text, FlatList, Image, StyleSheet, TouchableOpacity, Modal, Dimensions } from "react-native"
import { Clock, XIcon } from "lucide-react-native"
import { FadeLoading } from "react-native-fade-loading"

import moment from "moment"

import { useTrade } from "../../screens/TradeContext"
import LinkOpeningWeb from "../../screens/Home/NewsScreen/LinkOpeningWeb"
import APP_VARIANTS from "../../utils/Config"

const { width, height } = Dimensions.get("window")

const screenWidth = Dimensions.get("window").width
const screenHeight = Dimensions.get("window").height

const EducationalBlogs = ({ type, visible, setOpenBlogs }) => {
  const { blogs, fetchBlogs, isDatafetchingvideos } = useTrade()

  // console.log('blogsrtt_;',type);
  const [modalVisible, setModalVisible] = useState(false)
  const [currentUrl, setCurrentUrl] = useState("")
  const [loading, setLoading] = useState(false)
  const [title, settitle] = useState("")

  const openWebView = (item) => {
    // Check if we have actual content to display
    if (item.content && item.content.trim().length > 0) {
      // If there's HTML content, create a data URL to display it properly
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
    strong {
      font-weight: 600;
    }
    em {
      font-style: italic;
    }
    ol, ul {
      padding-left: 24px;
      margin-bottom: 20px;
    }
    li {
      margin-bottom: 10px;
    }
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
  <div class="blog-content">
    ${item.content}
  </div>
</body>
</html>
`

      const dataUrl = `data:text/html;charset=utf-8,${encodeURIComponent(htmlContent)}`
      setCurrentUrl(dataUrl)
    } else if (item.link || item.videoUrl) {
      // Fallback to external link
      setCurrentUrl(item.link || item.videoUrl)
    } else {
      // Show a message that content is not available
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
`
      setCurrentUrl(`data:text/html;charset=utf-8,${encodeURIComponent(noContentHtml)}`)
    }

    settitle(item.title)
    setModalVisible(true)
  }

  const convertToTimeAgo = (dateString) => {
    return moment(dateString).fromNow() // Returns relative time format like "1 day ago"
  }

  const renderItem = ({ item }) => (
    <TouchableOpacity activeOpacity={0.8} onPress={() => openWebView(item)}>
      <View style={[styles.blogCard, { width: type === "allblogs" ? width / 2 - 25 : 260 }]}>
        <Image
          source={{ uri: item.image_base64 || item.imageUrl }}
          style={styles.blogImage}
          defaultSource={require("../../assets/default.png")}
        />
        <View style={styles.textOverlay}>
          <Text numberOfLines={2} style={styles.blogTitle}>
            {item.title}
          </Text>
          <View style={styles.timestampContainer}>
            <Clock size={16} color={"white"} />
            <Text style={styles.timestampText}>{convertToTimeAgo(item.created_at)}</Text>
          </View>
        </View>
      </View>
    </TouchableOpacity>
  )
  return (
    <Modal visible={visible} transparent={true} animationType="slide">
      <View style={styles.modalOverlay}>
        <View style={[styles.modalContainer]}>
          <View
            style={{
              flexDirection: "row",
              justifyContent: "space-between",
              alignItems: "center",
              paddingHorizontal: 20,
              borderBottomWidth: 1,
              borderColor: "#ccc",
              marginBottom: 10,
              paddingVertical: 15,
            }}
          >
            {type === "allblogs" && (
              <View style={styles.header}>
                <Text style={styles.headerTitle}>Educational Blogs</Text>
              </View>
            )}
            <XIcon onPress={() => setOpenBlogs(false)} size={15} color={"#000"} />
          </View>

          <View style={{ alignContent: "center", alignItems: "center" }}>
            {type === "allblogs" ? (
              // console.log('type i am getting:',type),
              <FlatList
                data={blogs}
                renderItem={renderItem}
                keyExtractor={(item, index) => index.toString()}
                numColumns={2}
                showsVerticalScrollIndicator={false}
                ListEmptyComponent={() =>
                  isDatafetchingvideos ? (
                    <View style={{ flexDirection: "row" }}>
                      <FadeLoading
                        style={{ width: screenWidth * 0.8, height: 100, marginTop: 5, marginLeft: 10 }}
                        primaryColor="#f0f0f0"
                        secondaryColor="#e0e0e0"
                        duration={500}
                      />
                    </View>
                  ) : 
                  (
                    // <View style={{ alignItems: 'center', marginTop: 10 }}>
                    //   <Text style={{ opacity: 0.5,color:'grey' }}>No Content Found</Text>
                    // </View>
                    <View
                      style={{
                        flex: 1,
                        alignItems: "center",
                        justifyContent: "center",
                        padding: 24,
                        marginVertical: 30,
                        marginHorizontal: 20,
                        backgroundColor: APP_VARIANTS.EmptyStateUi.lightWarmColor, // Light warm background
                        borderRadius: 16,
                        overflow: "hidden",
                      }}
                    >
                      {/* Decorative background elements */}
                      <View
                        style={{
                          position: "absolute",
                          top: -50,
                          right: -50,
                          width: 150,
                          height: 150,
                          borderRadius: 75,
                          backgroundColor: "rgba(107, 20, 0, 0.08)", // #6B1400 with opacity
                        }}
                      />
                      <View
                        style={{
                          position: "absolute",
                          bottom: -40,
                          left: -40,
                          width: 120,
                          height: 120,
                          borderRadius: 60,
                          backgroundColor: "rgba(173, 66, 38, 0.06)", // Lighter shade of #6B1400
                        }}
                      />

                      {/* Icon container */}
                      <View
                        style={{
                          width: 70,
                          height: 70,
                          borderRadius: 35,
                          backgroundColor: "#fff",
                          justifyContent: "center",
                          alignItems: "center",
                          marginBottom: 20,
                          shadowColor: APP_VARIANTS.EmptyStateUi.backgroundColor, // Main reference color
                          shadowOffset: { width: 0, height: 4 },
                          shadowOpacity: 0.1,
                          shadowRadius: 8,
                          elevation: 3,
                        }}
                      >
                        <Text style={{ fontSize: 30 }}>📚</Text>
                      </View>

                      <Text
                        style={{
                          fontFamily: "Satoshi-Bold",
                          fontSize: 18,
                          color: APP_VARIANTS.EmptyStateUi.darkerColor, // Darker shade of reference color
                          textAlign: "center",
                          marginBottom: 10,
                        }}
                      >
                        No Educational Content Yet
                      </Text>

                      <Text
                        style={{
                          fontFamily: "Satoshi-Medium",
                          fontSize: 14,
                          color: APP_VARIANTS.EmptyStateUi.mediumColor, // Medium shade of reference color
                          textAlign: "center",
                          maxWidth: "90%",
                          lineHeight: 20,
                        }}
                      >
                        We're working on adding valuable educational resources for you. Check back soon!
                      </Text>

                      {/* Visual indicators */}
                      <View
                        style={{
                          flexDirection: "row",
                          marginTop: 20,
                          alignItems: "center",
                        }}
                      >
                        <View
                          style={{
                            width: 8,
                            height: 8,
                            borderRadius: 4,
                            backgroundColor: APP_VARIANTS.EmptyStateUi.backgroundColor, // Main reference color
                            marginHorizontal: 3,
                            opacity: 0.4,
                          }}
                        />
                        <View
                          style={{
                            width: 8,
                            height: 8,
                            borderRadius: 4,
                            backgroundColor: APP_VARIANTS.EmptyStateUi.backgroundColor, // Main reference color
                            marginHorizontal: 3,
                            opacity: 0.6,
                          }}
                        />
                        <View
                          style={{
                            width: 8,
                            height: 8,
                            borderRadius: 4,
                            backgroundColor: APP_VARIANTS.EmptyStateUi.backgroundColor, // Main reference color
                            marginHorizontal: 3,
                            opacity: 0.8,
                          }}
                        />
                        <View
                          style={{
                            width: 8,
                            height: 8,
                            borderRadius: 4,
                            backgroundColor: APP_VARIANTS.EmptyStateUi.backgroundColor, // Main reference color
                            marginHorizontal: 3,
                          }}
                        />
                      </View>
                    </View>
                  )
                }
                contentContainerStyle={{ paddingBottom: 50 }} // Add space at the bottom
              />
            ) : (
              <FlatList
                data={blogs}
                renderItem={renderItem}
                keyExtractor={(item) => item.id}
                horizontal // Horizontal list
                showsHorizontalScrollIndicator={false}
                ListEmptyComponent={() =>
                  loading ? (
                    <View style={{ flexDirection: "row" }}>
                      <FadeLoading
                        style={{ width: screenWidth * 0.5, height: 100, marginTop: 5, marginLeft: 10 }}
                        primaryColor="#f0f0f0"
                        secondaryColor="#e0e0e0"
                        duration={500}
                      />
                      <FadeLoading
                        style={{ width: screenWidth * 0.5, height: 100, marginTop: 5, marginLeft: 10 }}
                        primaryColor="#f0f0f0"
                        secondaryColor="#e0e0e0"
                        duration={500}
                      />
                    </View>
                  ) : (
                    <View style={{ alignItems: "center", marginTop: 10 }}>
                      <Text style={{ opacity: 0.5, color: "grey" }}>No Content Found</Text>
                    </View>
                  )
                }
                contentContainerStyle={styles.blogList}
              />
            )}
            <LinkOpeningWeb
              symbol={title}
              setWebview={setModalVisible}
              webViewVisible={modalVisible}
              currentUrl={currentUrl}
            />
          </View>
        </View>
      </View>
    </Modal>
  )
}

const styles = StyleSheet.create({
  containerEmpty: {
    paddingVertical: 50,
    justifyContent: "center",
    alignItems: "center",
    alignContent: "center",
    alignSelf: "center",
    backgroundColor: "#fDfDfD",
  },
  title: {
    fontSize: 14,
    fontFamily: "Satoshi-Medium",
    color: "#666",
    marginBottom: 0,
    textAlign: "center",
  },
  subtitle: {
    fontSize: 14,
    color: "#666",
    fontFamily: "Satoshi-Medium",
    textAlign: "center",
    marginBottom: 20,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  headerTitle: {
    fontSize: 20,
    fontFamily: "Satoshi-Bold",

    color: "black",
  },
  blogList: {
    paddingHorizontal: 5,
    alignContent: "center",
    alignItems: "center",
    alignSelf: "center",
  },
  blogCard: {
    backgroundColor: "#fff",
    borderRadius: 10,
    overflow: "hidden",
    width: 260,
    marginRight: 15,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 5,
    marginBottom: 10,
    elevation: 3, // For Android shadow
  },
  blogImage: {
    width: "100%",
    height: 150,
    borderTopLeftRadius: 10,
    borderTopRightRadius: 10,
  },
  blogTitle: {
    fontSize: 18,
    fontFamily: "Satoshi-Bold",
    color: "white",
  },
  textOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    paddingHorizontal: 15,
    right: 0,
    bottom: 0,
    justifyContent: "center",
    alignItems: "flex-start",
    backgroundColor: "rgba(0, 0, 0, 0.3)", // Dark overlay for text visibility
  },
  timestampContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 20,
  },
  timestampText: {
    fontSize: 12,
    color: "white",
    fontFamily: "Satoshi-Regular",
  },
  modalContainer: {
    backgroundColor: "#FFFEF7",
    borderTopRightRadius: 20,
    borderTopLeftRadius: 20,
    maxHeight: screenHeight - 100,
  },
  modalOverlay: {
    flex: 1,
    alignContent: "center",
    justifyContent: "flex-end",
    backgroundColor: "rgba(0, 0, 0, 0.3)",
  },
  webView: {
    borderTopColor: "#e9e9e9",
    borderWidth: 1,
    flex: 1,
  },
  loaderContainer: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "rgba(255, 255, 255, 0.8)", // Semi-transparent background
    zIndex: 1, // Ensure the loader is above the WebView
  },
})

export default EducationalBlogs
