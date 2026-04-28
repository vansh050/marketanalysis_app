"use client"

import { useState } from "react"
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  FlatList,
  Modal,
  Dimensions,
  Image,
  Platform,
  Alert,
} from "react-native"
import { FadeLoading } from "react-native-fade-loading"
import { Download, XIcon } from "lucide-react-native"
import axios from "axios"
import server from "../../utils/serverConfig"
import Toast from "react-native-toast-message"
import { Linking } from "react-native"
import RNFS from "react-native-fs"
import Share from "react-native-share"
import { decode as atob } from "base-64"
import Config from "react-native-config"
import { useTrade } from "../../screens/TradeContext"
import { generateToken } from "../../utils/SecurityTokenManager"
import APP_VARIANTS from "../../utils/Config"

const pdfcicon = require("../../assets/pdf.png")
const screenWidth = Dimensions.get("window").width
const screenHeight = Dimensions.get("window").height
const EducationalPDF = ({ type, visible, setOpenpdf }) => {
  const { fetchContent, pdf, configData} = useTrade()

  const [isLoading, setIsLoading] = useState(false)

  const formatFileSize = (bytes) => {
    if (!bytes) return "Unknown size"
    const mb = bytes / (1024 * 1024)
    if (mb < 1) {
      const kb = bytes / 1024
      return `${kb.toFixed(0)} KB`
    }
    return `${mb.toFixed(1)} MB`
  }

  const showToast = (message1, type, message2) => {
    Toast.show({
      type: type,
      text2: message2 + " " + message1,
      //position:'bottom',
      position: "bottom", // Duration the toast is visible
      text1Style: {
        color: "black",
        fontSize: 11,
        fontWeight: 0,
        fontFamily: "Poppins-Medium", // Customize your font
      },
      text2Style: {
        color: "black",
        fontSize: 12,
        fontFamily: "Poppins-Regular", // Customize your font
      },
    })
  }

  const completeDownloadStatement = async (pdfData) => {
    //console.log('pdf byte:',pdfData);
    try {
      if (pdfData) {
        // Define the file path based on the platform
        const fileName = `Account_statement_${new Date().getTime()}.pdf`
        const path =
          Platform.OS === "android"
            ? `${RNFS.DownloadDirectoryPath}/${fileName}`
            : `${RNFS.DocumentDirectoryPath}/${fileName}`

        // Decode base64 string to binary
        const binaryData = atob(pdfData)

        // Write the binary data to the file
        await RNFS.writeFile(path, binaryData, "ascii")

        // Check if the file exists
        const fileExists = await RNFS.exists(path)

        if (fileExists) {
          //openPDF(path);

          showToast("File successfully Saved at download folder", "success", "")

          console.log(`File successfully saved at ${path}`)
          // Optionally share the PDF on iOS
          if (Platform.OS === "ios") {
            await Share.open({
              url: `file://${path}`,
              type: "application/pdf",
              title: "Open PDF",
            })
          }
        } else {
          console.error("File not found after saving:", path)
        }
      } else {
        console.error("PDF data is empty")
      }
    } catch (error) {
      console.error("Error saving PDF:", error)
    }
  }

  const openPDF = async (path) => {
    try {
      console.log("path:", path)
      await Linking.openURL(`file:/${path}`).catch((err) => {
        Alert.alert("Error", "Could not open the PDF file.")
        console.error("Error opening PDF:", err)
      })
    } catch (error) {
      console.error("Error opening PDF:", error)
    }
  }

  const handleDownload = async (pdfID) => {
    setIsLoading(true)
    try {
      const response = await axios.get(`${server.ccxtServer.baseUrl}/misc/pdfs/download/${pdfID}`, {
        headers: {
          "Content-Type": "application/json",
          "X-Advisor-Subdomain":  configData?.config?.REACT_APP_HEADER_NAME,
          "aq-encrypted-key": generateToken(Config.REACT_APP_AQ_KEYS, Config.REACT_APP_AQ_SECRET),
        },
      })

      if (response.data && response.data.pdf_data) {
        await completeDownloadStatement(response.data.pdf_data)
      } else {
        showToast("PDF data not found", "error", "")
      }
    } catch (error) {
      console.error("Error downloading PDF:", error)
      showToast("Failed to download PDF", "error", "")
    } finally {
      setIsLoading(false)
    }
  }

  const handleViewPDF = async (pdfID) => {
    setIsLoading(true)
    try {
      const response = await axios.get(`${server.ccxtServer.baseUrl}/misc/pdfs/download/${pdfID}`, {
        headers: {
          "Content-Type": "application/json",
          "X-Advisor-Subdomain": configData?.config?.REACT_APP_HEADER_NAME,
          "aq-encrypted-key": generateToken(Config.REACT_APP_AQ_KEYS, Config.REACT_APP_AQ_SECRET),
        },
      })

      if (response.data && response.data.pdf_data) {
        // Create a temporary file for viewing
        const fileName = `pdf_${new Date().getTime()}.pdf`
        const path =
          Platform.OS === "android"
            ? `${RNFS.CachesDirectoryPath}/${fileName}`
            : `${RNFS.DocumentDirectoryPath}/${fileName}`

        const binaryData = atob(response.data.pdf_data)
        await RNFS.writeFile(path, binaryData, "ascii")

        // Open the PDF
        if (Platform.OS === "ios") {
          await Share.open({
            url: `file://${path}`,
            type: "application/pdf",
            title: "View PDF",
          })
        } else {
          await Linking.openURL(`file://${path}`)
        }

        showToast("PDF opened successfully", "success", "")
      } else {
        showToast("PDF data not found", "error", "")
      }
    } catch (error) {
      console.error("Error viewing PDF:", error)
      showToast("Failed to open PDF", "error", "")
    } finally {
      setIsLoading(false)
    }
  }

  const renderItem = ({ item }) => {
    return (
      <View style={styles.pdfCard}>
        <TouchableOpacity style={styles.pdfContent} onPress={() => handleViewPDF(item._id)} disabled={isLoading}>
          <Image source={pdfcicon} style={styles.pdfIcon} />
          <View style={styles.pdfCardContent}>
            <Text numberOfLines={1} style={styles.pdfCardTitle}>
              {item.title}
            </Text>
            <Text style={styles.pdfCardDescription}>
              {item.pages ? `${item.pages} Pages` : "PDF"} • {formatFileSize(item.file_size)}
            </Text>
          </View>
        </TouchableOpacity>
        <TouchableOpacity style={styles.downloadButton} onPress={() => handleDownload(item._id)} disabled={isLoading}>
          <Download size={25} color={isLoading ? "#ccc" : "black"} />
        </TouchableOpacity>
      </View>
    )
  }

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
            <View style={styles.header}>
              <Text style={styles.headerTitle}>Educational PDF</Text>
            </View>
            <XIcon onPress={() => setOpenpdf(false)} size={15} color={"#000"} />
          </View>

          <View style={styles.container}>
            <View
              style={{ flexDirection: "row", justifyContent: "space-between", marginTop: 10, paddingHorizontal: 10 }}
            >
              {isLoading ? (
                <FadeLoading
                  style={{ width: screenWidth * 0.5, height: 10, marginTop: 5 }}
                  primaryColor="#f0f0f0"
                  secondaryColor="#e0e0e0"
                  duration={500}
                />
              ) : type === "homepdf" ? (
                <Text style={styles.sectionTitle}>Educational PDF</Text>
              ) : null}
            </View>

            <FlatList
              data={pdf}
              keyExtractor={(item) => item._id}
              renderItem={renderItem}
              style={styles.flatList}
              ListEmptyComponent={
                // <View style={styles.containerEmpty}>

                //                             <Text style={styles.title}>No PDF</Text>
                //                 <Text style={styles.subtitle}>
                //                   Looks like there's no data to display right now.
                //                 </Text>
                //                      </View>
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
                    <Text style={{ fontSize: 30 }}>📄</Text>
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
                    No PDF Resources Yet
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
                    We're preparing PDF guides and resources for your learning journey. Stay tuned!
                  </Text>

                  {/* Document stack visual */}
                  <View
                    style={{
                      marginTop: 20,
                      alignItems: "center",
                      position: "relative",
                    }}
                  >
                    <View
                      style={{
                        width: 40,
                        height: 50,
                        backgroundColor: APP_VARIANTS.EmptyStateUi.lightColor, // Light shade of reference color
                        borderRadius: 4,
                        position: "absolute",
                        transform: [{ rotate: "-5deg" }],
                        left: -10,
                      }}
                    />
                    <View
                      style={{
                        width: 40,
                        height: 50,
                        backgroundColor: APP_VARIANTS.EmptyStateUi.mediumLightShade, // Medium light shade of reference color
                        borderRadius: 4,
                        position: "absolute",
                        transform: [{ rotate: "5deg" }],
                        right: -10,
                      }}
                    />
                    <View
                      style={{
                        width: 40,
                        height: 50,
                        backgroundColor: "#FFFFFF",
                        borderRadius: 4,
                        borderWidth: 1,
                        borderColor: APP_VARIANTS.EmptyStateUi.mutedColor, // Muted shade of reference color
                        zIndex: 1,
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      <Text style={{ fontSize: 16, color: "#6B1400" }}>PDF</Text>
                    </View>
                  </View>
                </View>
              }
            />
          </View>
        </View>
      </View>
    </Modal>
  )
}

const styles = StyleSheet.create({
  container: {
    marginBottom: 50,
    marginTop: 10,
    marginHorizontal: 10,
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
  headerTitle: {
    fontSize: 20,
    fontFamily: "Satoshi-Bold",
    color: "black",
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
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
  },
  containerEmpty: {
    paddingVertical: 50,
    flex: 1, // Ensures it takes up the entire available space
    justifyContent: "center", // Centers content vertically
    alignItems: "center", // Centers content horizontally
    alignContent: "center",
    backgroundColor: "#fDfDfD",
  },
  sectionTitle: {
    fontSize: 20,
    fontFamily: "Satoshi-Bold",
    marginBottom: 10,
    color: "black",
  },
  flatList: {
    marginTop: 10,
  },
  pdfCard: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: "#fff",
    padding: 10,
    borderRadius: 10,
    marginVertical: 5,
    marginHorizontal: 10,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    borderBottomWidth: 1,
    borderBottomColor: "#E6E6E6",
  },
  pdfContent: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1, // Ensures it takes the full width available
  },
  pdfIcon: {
    width: 40,
    height: 50,
  },
  pdfCardContent: {
    marginLeft: 10,
    flex: 1, // Takes up remaining space
    flexShrink: 1, // Allows it to shrink if space is limited
  },
  pdfCardTitle: {
    fontSize: 16,
    fontFamily: "Satoshi-Medium",
    color: "#333",
    flexShrink: 1, // Ensures it doesn't overflow
  },
  pdfCardDescription: {
    fontSize: 12,
    fontFamily: "Satoshi-Light",
    color: "#858585",
    marginTop: 5,
  },
  downloadButton: {
    padding: 10,
  },
})

export default EducationalPDF
