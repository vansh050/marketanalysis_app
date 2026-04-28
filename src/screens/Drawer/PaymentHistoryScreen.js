import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet,TouchableOpacity,ScrollView, FlatList,Image,Platform } from 'react-native';
import { ChevronLeft } from 'lucide-react-native';
import { read } from 'react-native-fs';
import { useNavigation } from '@react-navigation/native';
import server from '../../utils/serverConfig';
import axios from 'axios';
import RNFS from 'react-native-fs';
import * as base64 from 'base64-js';
import Share from 'react-native-share';
import { decode as atob } from 'base-64';
import Toast from 'react-native-toast-message';
import { getAuth } from '@react-native-firebase/auth';
import Config from 'react-native-config';
import { generateToken } from '../../utils/SecurityTokenManager';
import { useTrade } from '../TradeContext';
import LinearGradient from 'react-native-linear-gradient';
import FileViewer from 'react-native-file-viewer';
import { useConfig } from '../../context/ConfigContext';

const PaymentHistoryScreen = () => {
  const {configData}=useTrade();

  // Get dynamic colors from config
  const config = useConfig();
  const gradient1 = config?.gradient1 || 'rgba(0, 86, 183, 1)';
  const gradient2 = config?.gradient2 || 'rgba(0, 38, 81, 1)';
  const navigation = useNavigation();
  const [InvoiceData,setInvoiceData]=useState([]);
  
    const auth = getAuth();
    const user = auth.currentUser;
    const userEmail = user?.email;
  const getInvoiceDetails = async () => {
    try {
      const response = await axios.get(`${server.ccxtServer.baseUrl}comms/get-invoices/${userEmail}`,
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
      const invoices = response.data.invoices || [];
      // Sort newest to oldest by created_at or invoice_date
      invoices.sort((a, b) => {
        const dateA = a.created_at ? new Date(a.created_at) : new Date(0);
        const dateB = b.created_at ? new Date(b.created_at) : new Date(0);
        return dateB - dateA;
      });
      setInvoiceData(invoices);
    } catch (error) {
      console.error("Error fetching Invoice details:", error.response);
    }
  };

  useEffect(()=> {
    if(userEmail){
      getInvoiceDetails()
    }
  },[userEmail])

    const showToast = (message1, type,message2) => {
      Toast.show({
        type: type,
        text2: message2+ " "+message1,
        //position:'bottom',
        position: 'bottom', // Duration the toast is visible
        text1Style: {
          color: 'black',
          fontSize: 11,
          fontWeight:0,
          fontFamily:'Poppins-Medium' // Customize your font
        },
        text2Style: {
          color: 'black',
          fontSize: 12,
          fontFamily:'Poppins-Regular' // Customize your font
        },
      });
    };

const fetchInvoicePdf = async (invoiceIndex) => {
  try {
    const response = await axios.get(
      `${server.ccxtServer.baseUrl}comms/get-invoice-pdf/${userEmail}/${invoiceIndex}`,
      {
        headers: {
          'Content-Type': 'application/json',
          'X-Advisor-Subdomain': configData?.config?.REACT_APP_HEADER_NAME,
          'aq-encrypted-key': generateToken(
            Config.REACT_APP_AQ_KEYS,
            Config.REACT_APP_AQ_SECRET,
          ),
        },
      },
    );
    return response.data.pdf_bytes || null;
  } catch (error) {
    console.error('Error fetching invoice PDF:', error);
    return null;
  }
};

const savePdfToFile = async (pdfData, fileName) => {
  const path =
    Platform.OS === 'android'
      ? `${RNFS.DownloadDirectoryPath}/${fileName}`
      : `${RNFS.DocumentDirectoryPath}/${fileName}`;

  const binaryData = atob(pdfData);
  await RNFS.writeFile(path, binaryData, 'ascii');
  const fileExists = await RNFS.exists(path);
  if (!fileExists) {
    throw new Error('File not found after saving');
  }
  return path;
};

const handleViewInvoice = async (item, index) => {
  try {
    let pdfData = item.pdf_bytes;
    if (!pdfData) {
      pdfData = await fetchInvoicePdf(index);
    }
    if (!pdfData) {
      showToast('PDF data missing', 'error', '');
      return;
    }

    const fileName = `Invoice_${new Date().getTime()}.pdf`;
    const path = await savePdfToFile(pdfData, fileName);

    try {
      await FileViewer.open(path, {showOpenWithDialog: true});
    } catch (viewerError) {
      console.warn('Error opening file:', viewerError);
      if (Platform.OS === 'ios') {
        await Share.open({
          url: `file://${path}`,
          type: 'application/pdf',
          title: 'Open PDF',
        });
      }
    }
  } catch (error) {
    console.error('Error viewing PDF:', error);
    showToast('Error opening invoice', 'error', '');
  }
};

const handleDownloadInvoice = async (item, index) => {
  try {
    let pdfData = item.pdf_bytes;
    if (!pdfData) {
      pdfData = await fetchInvoicePdf(index);
    }
    if (!pdfData) {
      showToast('PDF data missing', 'error', '');
      return;
    }

    const invoiceNumber = item.invoice_data?.invoice_number || new Date().getTime();
    const fileName = `invoice_${invoiceNumber}.pdf`.replace(/\//g, '_');
    await savePdfToFile(pdfData, fileName);
    showToast('Invoice saved to Downloads', 'success', '');
  } catch (error) {
    console.error('Error downloading PDF:', error);
    showToast('Error downloading invoice', 'error', '');
  }
};

    const payments = [
        {
          id: '1',
          icon: 'A',
          name: 'Alpha 100',
          date: 'Invested on 07th Sept, 2024',
          amount: '₹999',
          bgColor: '#000000'
        },
        {
          id: '2',
          icon: '₹',
          name: 'Alpha 100',
          date: 'Invested on 07th Sept, 2024',
          amount: '₹5,999',
          bgColor: '#FEF3C7'
        },
        {
          id: '3',
          icon: '3',
          name: 'Alpha 100',
          date: 'Invested on 07th Sept, 2024',
          amount: '₹1,999',
          bgColor: '#059669'
        },
        {
          id: '4',
          icon: '⚡',
          name: 'Alpha 100',
          date: 'Invested on 07th Sept, 2024',
          amount: '₹899',
          bgColor: '#E9D5FF'
        },
        {
          id: '5',
          icon: '100',
          name: 'Alpha 100',
          date: 'Invested on 07th Sept, 2024',
          amount: '₹3,999',
          bgColor: '#1E3A8A'
        }
      ];
      
      const renderPaymentItem = ({ item, index }) => (
        <View style={styles.paymentItem}>
          <View style={styles.leftContent}>
            <View style={[styles.iconContainer, { backgroundColor: item.bgColor }]}>
              <Image source ={{uri: item.invoice_data.company_logo}} style={{ width: 40, height: 40, borderRadius: 25 }}/>
              <Text style={[
                styles.iconText,
                { color: ['#000000', '#FEF3C7'].includes(item.bgColor) ? '#000' : '#FFF' }
              ]}>
                {item.icon}
              </Text>
            </View>
            <View style={styles.textContainer}>
              <Text style={styles.nameText}>{item.invoice_data.item_description}</Text>
              <Text style={styles.dateText}>{item.invoice_data.invoice_date}</Text>
            </View>
          </View>
          <View style={styles.rightContent}>
            <Text style={styles.amountText}>₹{item.invoice_data.item_amount}</Text>
            <View style={{flexDirection: 'row', gap: 10, marginTop: 2}}>
              <TouchableOpacity onPress={() => handleDownloadInvoice(item, index)}>
                <Text style={styles.downloadText}>Download</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => handleViewInvoice(item, index)}>
                <Text style={styles.invoiceText}>View</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      );
      

      
      return (
        <View style={styles.container}>
            <LinearGradient
                      colors={[gradient1, gradient2]}
                      start={{x: 0, y: 0}}
                      end={{x: 0, y: 1}}
                      style={{
                        paddingHorizontal: 15,
                        paddingVertical: 15,
                        borderBottomLeftRadius: 15,
                        borderBottomRightRadius: 15,
                      }}>
                      <View
                        style={{flexDirection: 'row', alignItems: 'center', marginTop: 10}}>
                        <TouchableOpacity
                          style={styles.backButton}
                          onPress={() => navigation.goBack()}>
                          <ChevronLeft size={24} color="#000" />
                        </TouchableOpacity>
                        <View style={{justifyContent: 'center'}}>
                          <Text
                            style={{
                              fontSize: 20,
                              fontFamily: 'Poppins-Medium',
                              color: '#fff',
                            }}>
                            Payment History
                          </Text>
                        </View>
                      </View>
                      
                    </LinearGradient>
          <FlatList
            data={InvoiceData}
            renderItem={renderPaymentItem}
            keyExtractor={item => item.id}
            ListEmptyComponent={ <View style={{flex:1,alignContent:'center',alignItems:'center',alignSelf:'center',justifyContent:'center',marginVertical:40,}}>
              {/* <Text style={styles.amountText}>No Payment History to show</Text> */}
     
          {/* Decorative background elements */}
          <View style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            opacity: 0.7,
            backgroundColor: '#fff',
            borderRadius: 16,
          }}>
            <View style={{
              position: 'absolute',
              top: -80,
              right: -80,
              width: 200,
              height: 200,
              borderRadius: 100,
              backgroundColor: 'rgba(107, 20, 0, 0.08)',
            }} />
            <View style={{
              position: 'absolute',
              bottom: -60,
              left: -60,
              width: 180,
              height: 180,
              borderRadius: 90,
              backgroundColor: 'rgba(173, 66, 38, 0.06)',
            }} />
          </View>
          
          {/* Icon container */}
          <View style={{
            width: 90,
            height: 90,
            borderRadius: 45,
            backgroundColor: 'rgba(255, 255, 255, 0.9)',
            justifyContent: 'center',
            alignItems: 'center',
            marginBottom: 20,
            shadowColor: '#6B1400',
            shadowOffset: { width: 0, height: 4 },
            shadowOpacity: 0.15,
            shadowRadius: 10,
            elevation: 4,
          }}>
            <View style={{
              width: 70,
              height: 70,
              borderRadius: 35,
              backgroundColor: 'rgba(107, 20, 0, 0.05)',
              justifyContent: 'center',
              alignItems: 'center',
            }}>
              <Text style={{ fontSize: 32 }}>💸</Text>
            </View>
          </View>
          
          <Text style={{ 
            fontFamily: 'Satoshi-Bold', 
            fontSize: 20,
            color: '#3A0B00',
            textAlign: 'center',
            marginBottom: 12,
          }}>
            No Payment History
          </Text>
          
          <Text style={{
            fontFamily: 'Satoshi-Medium',
            fontSize: 15,
            color: '#4D2418',
            textAlign: 'center',
            maxWidth: '85%',
            lineHeight: 22,
            marginBottom: 20,
          }}>
            Your completed transactions will appear here once you make your first payment.
          </Text>
          
   
          
       
        </View>

         
            }
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={false}
          />
        </View>
  
      );
      };
      
      const styles = StyleSheet.create({
      container: {
        flex: 1,
        backgroundColor: '#FFFFFF',
      },
        headerGradient: {
    borderBottomLeftRadius: 16,
    borderBottomRightRadius: 16,
    paddingBottom: 10,
    paddingTop: 6,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    height: 52,
  },
  headerBack: {
    padding: 4,
    marginRight: 6,
  },
      listContent: {
        paddingHorizontal: 16,
      },
      header: {
        flexDirection: 'row',

        
        paddingVertical: 16,
        marginBottom: 8,
      },
        backButton: {
    padding: 4,
    borderRadius: 5,
    backgroundColor: '#fff',
    marginRight: 10,
  },

      headerTitle: {
       fontFamily:'Satoshi-Bold',fontSize:20,color:'black',alignContent:'center',alignItems:'center',alignSelf:'center'
      },
      paymentItem: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingVertical: 12,
      },
      leftContent: {
        flexDirection: 'row',
        alignItems: 'center',
      },
      iconContainer: {
        width: 40,
        height: 40,
        borderRadius: 8,
        justifyContent: 'center',
        alignItems: 'center',
      },
      iconText: {
        fontSize: 14,
        fontWeight: '500',
      },
      textContainer: {
        marginLeft: 12,
      },
      nameText: {
        fontSize: 16,
        fontFamily:'Satoshi-Bold',
        color: '#000000',
      },
      dateText: {
        fontSize: 14,
        color: '#6B7280',
        fontFamily:'Satoshi-Regular',
        marginTop: 2,
      },
      rightContent: {
        alignItems: 'flex-end',
      },
      amountText: {
        fontSize: 16,
        fontFamily:'Satoshi-Bold',
        color: '#000000',
      },
      invoiceText: {
        fontSize: 14,
        fontFamily:'Satoshi-Medium',
        color: '#2563EB',
      },
      downloadText: {
        fontSize: 14,
        fontFamily:'Satoshi-Medium',
        color: '#16A085',
      },
      });
      

export default PaymentHistoryScreen;
