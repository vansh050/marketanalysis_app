import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, FlatList, useWindowDimensions,Image } from 'react-native';
import EducationalCard from './EducationalCard'; // Assuming you have an EducationalCard component for each item
import { FadeLoading } from 'react-native-fade-loading';
import Icon1 from 'react-native-vector-icons/FontAwesome5';
import {XIcon, BanIcon, CalendarDays, MinusIcon, PlusIcon ,ChevronDownIcon,Download,FileText, ChevronRight} from "lucide-react-native";
const pdfcicon = require('../../assets/pdf.png');
const EducationalContent = () => {
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
      { id: '1', title: 'Understanding Market Trends', image: require('../../assets/ed1.png'), content: 'Instead of investing small sums over time through Systematic Investment Plans, the lump sum investments entail making to.....' },
      { id: '2', title: 'Stock Analysis Basics', image: require('../../assets/ed2.png'), content: 'Instead of investing small sums over time through Systematic Investment Plans, the lump sum investments entail making to.....' },
    ],
    Videos: [
      { id: '1', title: 'How to Trade Stocks',image: require('../../assets/ed1.png'), content: 'Video Content' },
      { id: '2', title: 'Investment Strategies',image: require('../../assets/ed2.png'), content: 'Video Content' },
    ],
    PDF: [
      { id: '1', title: 'Trading Guide', content: 'PDF Content' },
      { id: '2', title: 'Investment Basics', content: 'PDF Content' },
    ],
  };

  const handleDownload = (item) => {
    // Logic to handle the PDF download, for example, downloading from a URL
    //console.log(`Downloading ${item.title}`);
  };

  const renderItem = ({ item }) => {
    if (selectedTab === 'PDF') {
    //  console.log('hererere');
      return (
        <View style={styles.pdfCard}>
          
          <View style={{flexDirection:'row',alignContent:'center',alignItems:'center'}}>
          <Image source={pdfcicon} style={{ width: 45, height: 45 }} />
          <View style={styles.pdfCardContent}>
            <Text style={styles.pdfCardTitle}>{item.title}</Text>
            <Text style={{fontFamily: 'Poppins-SemiBold',color: '#4B8CEE', padding: 1 }}>Download</Text>
          </View>
          </View>
          
          <TouchableOpacity style={styles.downloadButton} onPress={() => handleDownload(item)}>
             <ChevronRight size={25} color={'black'}/>
            </TouchableOpacity>
        </View>
      );
    } else if (selectedTab === 'Blog') {
      return (
     //   console.log('card'),
        <EducationalCard title={item.title} image={item.image} content={item.content} />
      );
    } else {
      return (
        <EducationalCard title={item.title} image={item.image} content={item.content} />
      );
    }
  };

  return (
    <View style={styles.container}>
      {/* Tabs */}
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 10, paddingHorizontal: 10 }}>
        {isLoading ? (
          <FadeLoading
            style={{ width: screenWidth * 0.5, height: 10, marginTop: 5 }} // Adjust width for price loading
            primaryColor="#f0f0f0"
            secondaryColor="#e0e0e0"
            duration={500}
          />
        ) : (
          <Text style={styles.sectionTitle}>Educational Content</Text>
        )}

        <TouchableOpacity>
          {isLoading ? (
            <FadeLoading
              style={{ width: screenWidth * 0.1, height: 10, marginTop: 5 }} // Adjust width for price loading
              primaryColor="#f0f0f0"
              secondaryColor="#e0e0e0"
              duration={500}
            />
          ) : (
            <Text style={styles.seeAllText}>See All</Text>
          )}
        </TouchableOpacity>
      </View>

      {isLoading ? (
        <FadeLoading
          style={{ width: screenWidth * 0.5, height: 20, marginTop: 5, marginLeft: 10 }} // Adjust width for price loading
          primaryColor="#f0f0f0"
          secondaryColor="#e0e0e0"
          duration={500}
        />
      ) : (
        <View style={styles.tabContainer}>
          {['Blog', 'Videos', 'PDF'].map((tab) => (
            <TouchableOpacity
              key={tab}
              style={[
                styles.filterButton,
                selectedTab === tab ? styles.activeTabButton : styles.inactiveTabButton
              ]}
              onPress={() => setSelectedTab(tab)}
            >
              <Text
                style={[
                  styles.filterButtonText,
                  selectedTab === tab ? styles.activeTabButtonText : styles.inactiveTabButtonText
                ]}
              >
                {tab}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      )}

      {/* Educational Cards */}
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
    marginBottom: 50,
    marginTop: 10,
    marginHorizontal: 10,
  },
  seeAllText: {
    fontSize: 14,
    fontFamily: 'Poppins-Regular',
    color: '#4B8CEE',
    marginRight: 10,
  },
  sectionTitle: {
    fontSize: 20,
    fontFamily: 'Poppins-Medium',
    marginBottom: 10,
    color: 'black',
  },
  filterButton: {
    backgroundColor: 'white',
    borderRadius: 20,
    marginLeft: 10,
    paddingVertical: 2,
    borderColor: '#E6E6E6',
    borderWidth: 1,
    paddingHorizontal: 25,
    marginLeft: 12,
  },
  filterButtonText: {
    fontSize: 13,
    fontFamily: 'Poppins-Regular',
    color: 'black',
  },
  tabContainer: {
    flexDirection: 'row',
  },
  activeTabButton: {
    backgroundColor: '#fff',
  },
  inactiveTabButton: {
    backgroundColor: '#F4F4F4',
  },
  activeTabButtonText: {
    color: 'black',
  },
  inactiveTabButtonText: {
    color: '#ABABAB',
  },
  flatList: {
    marginTop: 10,
  },
  pdfCard: {
    justifyContent:'space-between',
    backgroundColor: '#f5f5f5',
    padding: 10,
    flexDirection: 'row',
    borderRadius: 10,
    backgroundColor: '#fff',
    elevation: 3,
    marginVertical: 5,
    marginHorizontal:10,
    alignItems:'center',
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  pdfCardContent: {
    flexDirection: 'colum',
    marginLeft:20,
  },
  pdfCardTitle: {
    fontSize: 16,
    fontFamily: 'Poppins-Medium',
    color: '#333',
  },
  downloadButton: {
    padding: 10,
  },
  pdfCardDescription: {
    fontSize: 12,
    fontFamily: 'Poppins-Light',
    color: '#858585',
    marginTop: 5,
  },
});

export default EducationalContent;
