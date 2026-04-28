import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, FlatList, useWindowDimensions, Image } from 'react-native';
import { FadeLoading } from 'react-native-fade-loading';
import { Download } from "lucide-react-native";

const pdfcicon = require('../../assets/pdf.png');

const AllEducationalPDF = () => {
  const { width: screenWidth } = useWindowDimensions();
  const [selectedTab, setSelectedTab] = useState('Blog');
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Simulating a delay to show loading
    const timeout = setTimeout(() => {
      setIsLoading(false);
    }, 2000); // Adjust the time as needed

    return () => clearTimeout(timeout);
  }, []);

  const educationalData = {
    Blog: [
      {
        id: '1',
        title: 'Understanding Market Trends',
        image: require('../../assets/edu1.png'),
        content: 'Instead of investing small sums over time through Systematic Investment Plans, lump sum investments entail making a significant one-time investment to capitalize on market conditions.'
      },
      {
        id: '2',
        title: 'Stock Analysis Basics',
        image: require('../../assets/ed2.png'),
        content: 'Stock analysis involves evaluating a company’s financial health, performance metrics, and market position to make informed investment decisions.'
      },
      {
        id: '3',
        title: 'Diversification Strategies for Investors',
        image: require('../../assets/edu1.png'),
        content: 'Diversification helps reduce risk by spreading investments across various assets. This approach can stabilize overall portfolio performance.'
      },
      {
        id: '4',
        title: 'Understanding Risk and Return in Investing',
        image: require('../../assets/ed2.png'),
        content: 'The risk-return relationship states that higher potential returns come with higher risk. Understanding this is crucial for making investment decisions.'
      },
      {
        id: '5',
        title: 'Technical Analysis: A Beginner\'s Guide',
        image: require('../../assets/edu1.png'),
        content: 'Technical analysis involves using historical price and volume data to predict future price movements, often utilizing charts and technical indicators.'
      },
      {
        id: '6',
        title: 'Fundamental Analysis Techniques for Stocks',
        image: require('../../assets/ed2.png'),
        content: 'Fundamental analysis assesses a company’s intrinsic value by examining economic factors, financial statements, and market conditions.'
      },
      {
        id: '7',
        title: 'Investment Psychology: How Emotions Affect Decisions',
        image: require('../../assets/edu1.png'),
        content: 'Understanding the psychological factors that influence investor behavior can help in making better investment choices and avoiding emotional decisions.'
      },
      {
        id: '8',
        title: 'Building a Comprehensive Financial Plan',
        image: require('../../assets/ed2.png'),
        content: 'Creating a comprehensive financial plan involves setting financial goals, assessing your current financial situation, and developing strategies to achieve those goals.'
      }
    ],
    Videos: [
      { id: '1', title: 'How to Trade Stocks', image: require('../../assets/ed1.png'), content: 'Video Content' },
      { id: '2', title: 'Investment Strategies', image: require('../../assets/ed2.png'), content: 'Video Content' },
    ],
    PDF: [
      { id: '1', title: 'Trading Guide', content: 'PDF Content' },
      { id: '2', title: 'Investment Basics', content: 'PDF Content' },
    ],
  };

  const handleDownload = (item) => {
    // Logic to handle the PDF download, for example, downloading from a URL
  //  console.log(`Downloading ${item.title}`);
  };

  const renderItem = ({ item }) => {
    return (
      <View style={styles.pdfCard}>
        <View style={styles.pdfContent}>
          <Image source={pdfcicon} style={styles.pdfIcon} />
          <View style={styles.pdfCardContent}>
            <Text numberOfLines={1} style={styles.pdfCardTitle}>{item.title}</Text>
            <Text style={styles.pdfCardDescription}>10 Pages • 3 MB</Text>
          </View>
        </View>
        <TouchableOpacity style={styles.downloadButton} onPress={() => handleDownload(item)}>
          <Download size={25} color={'black'} />
        </TouchableOpacity>
      </View>
    );
  };

  return (
    <View style={styles.container}>

      <FlatList
        data={educationalData[selectedTab]}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        style={styles.flatList}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    paddingBottom:10,
    marginTop: 10,
    marginHorizontal: 10,
  },
  sectionTitle: {
    fontSize: 20,
    fontFamily: 'Poppins-Medium',
    marginBottom: 10,
    color: 'black',
  },
  flatList: {
    marginTop: 10,
  },
  pdfCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#fff',
    padding: 10,
    borderRadius: 10,
    marginVertical: 5,
    marginHorizontal: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    borderBottomWidth: 1,
    borderBottomColor: '#E6E6E6',
  },
  pdfContent: {
    flexDirection: 'row',
    alignItems: 'center',
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
    fontFamily: 'Poppins-Medium',
    color: '#333',
    flexShrink: 1, // Ensures it doesn't overflow
  },
  pdfCardDescription: {
    fontSize: 12,
    fontFamily: 'Poppins-Light',
    color: '#858585',
    marginTop: 5,
  },
  downloadButton: {
    padding: 10,
  },
});

export default AllEducationalPDF;
