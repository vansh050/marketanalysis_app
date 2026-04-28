import React from "react";
import { View, Text, TouchableOpacity, StyleSheet, Dimensions, ScrollView } from "react-native";
import LinearGradient from "react-native-linear-gradient";
import Icon from "react-native-vector-icons/MaterialIcons";
import { useNavigation } from "@react-navigation/native";
import Config from "../../utils/safeConfig";
import { useConfig } from "../../context/ConfigContext";
// Note: APP_VARIANTS removed - using dynamic config from useConfig()

const screenWidth = Dimensions.get('window').width;

const ExploreSection = ({
  setSelectedTab,
  setOpenBlogs,
  setOpenpdf,
  setOpenvideos,
}) => {
  const selectedVariant = Config?.APP_VARIANT || 'alphaquark';
  const navigate = useNavigation();

  // Get dynamic config from API
  const config = useConfig();
  const themeColor = config?.themeColor || '#0056B7';

  const exploreItems = [
    { 
      name: "Blogs", 
      icon: "rss-feed", 
      gradientColors: ["#8A2BE2", "#9370DB"],
      description: "Articles" 
    },
    { 
      name: "Videos", 
      icon: "play-circle-fill", 
      gradientColors: ["#FF4500", "#FF7F50"],
      description: "Watch" 
    },
    { 
      name: "PDFs", 
      icon: "picture-as-pdf", 
      gradientColors: ["#32CD32", "#90EE90"],
      description: "Docs" 
    },
    { 
      name: "News", 
      icon: "newspaper", 
      gradientColors: ["#1E90FF", "#87CEFA"],
      description: "Updates" 
    },
  ];

  // Show NEWS only if selectedVariant === 'arfs'
  const filteredItems =
    selectedVariant === "arfs"
      ? exploreItems
      : exploreItems.filter((item) => item.name.toUpperCase() !== "NEWS");

  const handleItemPress = (item) => {
    const itemName = item.name.toUpperCase();
    if (itemName === "BLOGS") {
      setOpenBlogs(true);
    } else if (itemName === "VIDEOS") {
      setOpenvideos(true);
    } else if (itemName === "PDFS") {
      setOpenpdf(true);
    } else if (itemName === "NEWS") {
      navigate.navigate("News");
    }
  };

  return (
    <View style={styles.container}>
      {/* Section Header */}
      <View style={styles.headerContainer}>
        <View style={styles.headerLine} />
        <Text style={styles.headerText}>Explore</Text>
        <View style={styles.headerLine} />
      </View>

    <View style={{flexDirection:'row',alignContent:'center',alignItems:'center',alignSelf:'center',}}>
    {filteredItems.map((item, index) => (
          <TouchableOpacity
            key={index}
            style={styles.cardWrapper}
            onPress={() => handleItemPress(item)}
            activeOpacity={0.8}
          >
            <LinearGradient
              colors={item.gradientColors}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.card}
            >
              <View style={styles.iconContainer}>
                <Icon name={item.icon} size={20} color="#FFFFFF" />
              </View>
              <Text style={styles.cardTitle}>{item.name}</Text>
          
            </LinearGradient>
          </TouchableOpacity>
        ))}
    </View>
    

    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    width: '100%',
    paddingVertical: 16,
  },
  headerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    paddingHorizontal: 16,
  },
  headerLine: {
    flex: 1,
    height: 1,
    backgroundColor: '#E0E0E0',
  },
  headerText: {
    fontSize: 16,
    fontFamily: 'Satoshi-Medium',
    color: '#333333',
    paddingHorizontal: 12,
    letterSpacing: 1,
  },
  scrollContainer: {
    paddingHorizontal: 16,
    paddingBottom: 4,
  },
  cardWrapper: {
    marginHorizontal: 5,
    borderRadius: 10,
    overflow: 'hidden',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  card: {
    width: 90,
    height: 85,
    padding: 10,
    borderRadius: 10,
    alignItems: 'center',
  },
  iconContainer: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  cardTitle: {
    fontFamily: 'Satoshi-Bold',
    fontSize: 14,
    color: '#FFFFFF',
    marginBottom: 2,
    textAlign: 'center',
  },
  cardDescription: {
    fontFamily: 'Satoshi-Regular',
    fontSize: 10,
    color: 'rgba(255, 255, 255, 0.9)',
    textAlign: 'center',
  }
});

export default ExploreSection;