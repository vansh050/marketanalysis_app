// screens/VideosScreen.js
import React from "react";
import {
  SafeAreaView,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
} from "react-native";
import { ArrowLeft, ChevronLeft } from "lucide-react-native";
import KnowledgeHub from "../KnowledgeHub";
import LinearGradient from "react-native-linear-gradient";

const VideosScreen = ({ navigation, route }) => {
  const { videos, title } = route.params || {};

  return (
    <SafeAreaView style={styles.container}>
  
      

      <View style={styles.content}>
        <KnowledgeHub navigation={navigation} type="full" initialTab="Videos" />
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#FFFFFF",
  },  backButton: { padding: 4, borderRadius: 5, backgroundColor: '#fff', marginRight: 10 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#F0F0F0",
  },

  headerContent: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#1A1A1A",
    fontFamily: "Poppins-SemiBold",
    marginBottom: 2,
  },
  headerSubtitle: {
    fontSize: 12,
    color: "#6B7280",
    fontFamily: "Poppins-Regular",
  },
  content: {
    flex: 1,
    backgroundColor: "#F9F9F9",
  },
});

export default VideosScreen;
