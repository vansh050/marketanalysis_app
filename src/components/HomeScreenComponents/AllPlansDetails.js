import React, { useState, useRef, useEffect } from 'react';
import {
  StyleSheet,
  Text,
  View,
  SafeAreaView,
  TouchableOpacity,
  FlatList,
  Dimensions,
  Modal,
  ScrollView,
  SectionList,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import Icon from 'react-native-vector-icons/Feather';
import MaterialIcon from 'react-native-vector-icons/MaterialCommunityIcons';
import server from '../../utils/serverConfig';
import { generateToken } from '../../utils/SecurityTokenManager';
import Config from 'react-native-config';
import { getAuth } from '@react-native-firebase/auth';
import axios from 'axios';
import { useTrade } from '../../screens/TradeContext';
import { useGstConfig } from '../../context/GstConfigContext';
import { withGst, gstLabel } from '../../utils/gstHelpers';
import RenderHTML from 'react-native-render-html';
import { useWindowDimensions } from 'react-native';
import PlanCard from './PlanCard';
const { width } = Dimensions.get('window');
const CARD_WIDTH = width * 0.8;
const CARD_SPACING = 16;

const AllPlanDetails = ({ type }) => {
  const { userDetails, planList,configData } = useTrade();
  const { gstConfigure: configGst, gstWithTextConfigure: configGstWithText } = useGstConfig();
  const [activeIndex, setActiveIndex] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const [allStrategy, setAllStrategy] = useState([]);
  const [allBespoke, setAllBespoke] = useState([]);
  const [modalVisible, setModalVisible] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState(null);

  const flatListRef = useRef(null);
  const advisorTag = configData?.config?.REACT_APP_ADVISOR_SPECIFIC_TAG;
  const auth = getAuth();
  const navigation = useNavigation();
  const user = auth.currentUser;
  const userEmail = user?.email;

  const subscribed = !planList;

  const onViewableItemsChanged = useRef(({ viewableItems }) => {
    if (viewableItems.length > 0) {
      setActiveIndex(viewableItems[0].index);
    }
  }).current;

  const getAllStrategy = async () => {
    setRefreshing(true);
    const apiUrl = `${server.server.baseUrl}api/admin/plan/${advisorTag}/model portfolio/${userEmail}`;
    console.log('📊 [AllPlansDetails] Fetching model portfolio strategies...');
    console.log('📊 [AllPlansDetails] URL:', apiUrl);
    console.log('📊 [AllPlansDetails] advisorTag:', advisorTag);
    console.log('📊 [AllPlansDetails] userEmail:', userEmail);
    try {
      const response = await axios.get(
        apiUrl,
        {
          headers: {
            "Content-Type": "application/json",
            "X-Advisor-Subdomain":  configData?.config?.REACT_APP_HEADER_NAME,
            "aq-encrypted-key": generateToken(
              Config.REACT_APP_AQ_KEYS,
              Config.REACT_APP_AQ_SECRET
            ),
          },
        }
      );
      setAllStrategy(response.data.data);
    } catch (error) {
      console.error('❌ [AllPlansDetails] Error:', error);
      console.error('❌ [AllPlansDetails] Error response:', error.response?.data);
    } finally {
      setRefreshing(false);
    }
  };

  const getAllBespoke = async () => {
    setRefreshing(true);
    try {
      const response = await axios.get(
        `${server.server.baseUrl}api/admin/plan/${advisorTag}/bespoke/${userEmail}`,
        {
          headers: {
            "Content-Type": "application/json",
            "X-Advisor-Subdomain":  configData?.config?.REACT_APP_HEADER_NAME,
            "aq-encrypted-key": generateToken(
              Config.REACT_APP_AQ_KEYS,
              Config.REACT_APP_AQ_SECRET
            ),
          },
        }
      );
      setAllBespoke(response.data.data);
    } catch (error) {
      console.log(error);
    } finally {
      setRefreshing(false);
    }
  };

  useEffect(() => {
    if (configData && advisorTag) {
      getAllStrategy();
      getAllBespoke();
    }
  }, [configData, advisorTag]);

  const processedBespoke = allBespoke
    ?.filter((plan) => {
      if (
        plan?.name === "priorRecommendationPlan" &&
        userDetails?.previous_stocks_advice_purchased === true
      ) {
        return false;
      }
      return true;
    })
    .sort((p1, p2) => {
      if (p1.name === "priorRecommendationPlan") return 1;
      if (p2.name === "priorRecommendationPlan") return -1;
      return (p1?.subscription == null) - (p2?.subscription == null);
    });

  const combinedPlans = [
    ...(processedBespoke || []),
    ...(allStrategy || []),
  ];

  const displayPlans = subscribed
    ? combinedPlans.filter(plan =>
      plan.subscription && plan.subscription.status === "active"
    )
    : combinedPlans;

  const mapPlanToCard = (plan) => ({
    id: plan._id,
    title: plan.name || "Plan Title",
    author: plan.advisor || "Advisor Name",
    invested: plan.subscription?.amount || "-",
    returns: '—',
    returnsPercentage: '—',
    validity: (plan.subscription?.original_end_date || plan.subscription?.end_date)
      ? new Date(plan.subscription.original_end_date ? plan.subscription.original_end_date : plan.subscription.end_date).toLocaleDateString()
      : '-',
    type: plan.type, // MP or Bespoke
    description: plan.description || '-',
    planDetails: plan,
  });

  const openModal = (plan) => {
    setSelectedPlan(plan);
    setModalVisible(true);
  };

  const renderItem = ({ item }) => {
    const card = mapPlanToCard(item);
    return (
      <View style={styles.carouselCard}>
        <View style={styles.cardHeader}>
          <View style={styles.cardIcon}>
            <MaterialIcon name="finance" size={24} color="#4A90E2" />
          </View>
          <View style={styles.cardTitleContainer}>
            <Text style={styles.cardTitle}>{card.title}</Text>
            <Text style={styles.cardAuthor}>{card.author}</Text>
            <Text style={styles.planTypeTag}>
              {card.type === 'bespoke' ? 'Bespoke' : 'MP'}
            </Text>
          </View>
        </View>

        {subscribed && (
          <View style={styles.cardBody}>
            <View style={styles.cardInfo}>
              <Text style={styles.infoLabel}>Invested Amount</Text>
              <Text style={styles.infoValue}>
                {card.invested !== '-' ? `₹ ${card.invested}` : '-'}
              </Text>
            </View>

            <View style={styles.cardInfo}>
              <Text style={styles.infoLabel}>Validity</Text>
              <Text style={styles.infoValue}>{card.validity}</Text>
            </View>
          </View>
        )}

        <TouchableOpacity
          style={styles.detailsButton}
          onPress={() => openModal(item)}
        >
          <Text style={styles.detailsButtonText}>Details</Text>
        </TouchableOpacity>

        {!subscribed && (
          <TouchableOpacity
            onPress={() => navigation.navigate('Model Portfolio')}
            style={styles.subscribeButton}
          >
            <Text style={styles.subscribeButtonText}>Subscribe Now</Text>
          </TouchableOpacity>
        )}
      </View>
    );
  };

  const totalInvestment = displayPlans
    .filter(plan => plan.subscription && plan.subscription.status === "active")
    .reduce((sum, plan) => sum + (Number(plan.subscription.amount) || 0), 0);

  const Pagination = () => (
    <View style={styles.paginationContainer}>
      {displayPlans.map((_, index) => (
        <View
          key={index}
          style={[
            styles.paginationDot,
            { backgroundColor: index === activeIndex ? '#FFFFFF' : '#6A7A9C' },
          ]}
        />
      ))}
    </View>
  );


  const sections = [
    {
      title: "Top Bespoke plans",
      data: allBespoke,
      type: "bespoke"
    },
    {
      title: "Model Portfolios",
      data: allStrategy,
      type: "mp"
    }
  ]

  const renderSectionHeader = ({ section }) => (
    <View style={styles.sectionHeader}>
      <Text style={styles.sectionTitle}>{section.title}</Text>
      <TouchableOpacity onPress={() => console.log("View all for", section.title)}>
        <Text style={styles.viewAllText}>View All</Text>
      </TouchableOpacity>
    </View>
  );

  const handleSubscribe = (plan) => {
    console.log("Subscribing to", plan.name);
    // Navigate to your subscription screen
    navigation.navigate('Model Portfolio');
  }
const renderPlanItem = ({ item }) => {
  if (item.type === "model portfolio") {
    console.log("Item ---", item);
  }

  return (
    <PlanCard
      type={item.type} // use actual plan type
      name={item.name || "Plan Name"}
      data={item}
      minAmount={item.minInvestment || "12,800"}
      validity={item.duration ? `${item.duration / 30} month` : "3 month"}
      onSubscribe={() => handleSubscribe(item)}
      onMoreDetails={() => openModal(item)}
    />
  );
};

  return (
    <SafeAreaView style={styles.container}>
      <View style={{ flex: 1, }}>
        <FlatList
          data={(type === "bespoke" || type === "bespokeAll") ? processedBespoke : allStrategy}
          keyExtractor={(item) => item._id}
          renderItem={renderPlanItem}
          style={{ flex: 1, }}
          horizontal={(type === "mpAll" || type === "bespokeAll") ? false : true}
          contentContainerStyle={[
          styles.listContainer,
           
          (type === "mpAll" || type === "bespokeAll") && { flexGrow: 1,marginLeft:10 }
          ]}
        />
      </View>


      {/* Your existing modal code */}
      <Modal
        visible={modalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            {/* Header */}
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{selectedPlan?.name}</Text>
              <View
                style={[
                  styles.planTag,
                  {
                    backgroundColor:
                      selectedPlan?.type === 'bespoke' ? '#F59E0B' : '#10B981',
                  },
                ]}
              >
                <Text style={styles.planTagText}>
                  {selectedPlan?.type === 'bespoke' ? 'Bespoke' : 'MP'}
                </Text>
              </View>
            </View>

            <ScrollView style={styles.modalContent} showsVerticalScrollIndicator={false}>
              {/* Advisor */}
              <View style={styles.infoCard}>
                <Text style={styles.infoLabel}>Advisor</Text>
                <Text style={styles.infoValue}>{selectedPlan?.advisor}</Text>
              </View>

              {/* Invested / Minimum Investment */}
              {selectedPlan?.subscription?.amount || selectedPlan?.minInvestment ? (
                <View style={styles.infoCard}>
                  <Text style={styles.infoLabel}>Invested / Minimum</Text>
                  <Text style={styles.infoValue}>
                    {selectedPlan?.subscription?.amount
                      ? `₹ ${selectedPlan.subscription.amount}`
                      : selectedPlan?.minInvestment
                        ? `₹ ${selectedPlan.minInvestment}`
                        : '-'}
                  </Text>
                </View>
              ) : null}

              {/* Validity / Duration */}
              {selectedPlan?.subscription?.end_date || selectedPlan?.duration ? (
                <View style={styles.infoCard}>
                  <Text style={styles.infoLabel}>Validity / Duration</Text>
                  <Text style={styles.infoValue}>
                    {selectedPlan?.subscription?.end_date
                      ? new Date(selectedPlan.subscription.end_date).toLocaleDateString()
                      : selectedPlan?.duration
                        ? `${selectedPlan.duration} days`
                        : '-'}
                  </Text>
                </View>
              ) : null}

              {/* Description */}
              {selectedPlan?.description && (
                <View style={styles.infoCard}>
                  <Text style={styles.infoLabel}>Description</Text>
                  <RenderHTML
                    contentWidth={width - 64} // adjust for modal padding
                    source={{ html: selectedPlan.description }}
                    baseStyle={styles.infoValue}
                  />
                </View>
              )}

              {/* Onetime Options */}
              {selectedPlan?.onetimeOptions?.length > 0 && (
                <View style={styles.infoCard}>
                  <Text style={[styles.infoLabel, { marginBottom: 8 }]}>Onetime Options</Text>
                  {selectedPlan.onetimeOptions.map((opt, index) => (
                    <View key={index} style={styles.optionRow}>
                      <Text style={styles.optionLabel}>{opt.label || `${opt.duration} Days`}</Text>
                      <Text style={styles.optionValue}>₹ {configGst && configGstWithText ? withGst(opt.amountWithoutGst || opt.amount) : (opt.amountWithoutGst || opt.amount)}{gstLabel(configGst, configGstWithText)}</Text>
                    </View>
                  ))}
                </View>
              )}

              {/* Recurring / Frequency Options */}
              {selectedPlan?.frequency?.length > 0 && (
                <View style={styles.infoCard}>
                  <Text style={[styles.infoLabel, { marginBottom: 8 }]}>Recurring Options</Text>
                  {selectedPlan.frequency.map((freq, index) => {
                    const price = selectedPlan.pricing?.[freq];
                    return (
                      <View key={index} style={styles.optionRow}>
                        <Text style={styles.optionLabel}>
                          {freq.charAt(0).toUpperCase() + freq.slice(1)}
                        </Text>
                        <Text style={styles.optionValue}>
                          {price && Number(price) > 0 ? `₹ ${configGst && configGstWithText ? withGst(selectedPlan.pricingWithoutGst?.[freq] || price) : (selectedPlan.pricingWithoutGst?.[freq] || price)}${gstLabel(configGst, configGstWithText)}` : 'N/A'}
                        </Text>
                      </View>
                    );
                  })}
                </View>
              )}
            </ScrollView>

            {/* Close Button */}
            <TouchableOpacity
              onPress={() => setModalVisible(false)}
              style={styles.modalCloseButton}
            >
              <Text style={styles.modalCloseButtonText}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'transparent'
  },
  listContainer: {
    paddingHorizontal: 16,
    backgroundColor: 'transparent',
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 24,
    marginBottom: 8,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#000'
  },
  viewAllText: {
    fontSize: 14,
    color: '#1976D2',
    fontWeight: '600'
  },
  // Modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContainer: {
    width: '90%',
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    maxHeight: '80%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
    elevation: 10,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1F2937',
    flex: 1,
    flexWrap: 'wrap',
  },
  planTag: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  planTagText: { color: '#fff', fontSize: 12, fontWeight: '600' },
  modalContent: { marginTop: 8 },
  infoCard: {
    backgroundColor: '#F3F4F6',
    borderRadius: 10,
    padding: 12,
    marginBottom: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
  },
  infoLabel: { fontSize: 12, fontWeight: '500', color: '#6B7280', marginBottom: 4 },
  infoValue: { fontSize: 14, fontWeight: '600', color: '#111827' },
  optionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 4,
    borderBottomWidth: 0.5,
    borderBottomColor: '#E5E7EB',
  },
  optionLabel: { fontSize: 14, color: '#374151', fontWeight: '500' },
  optionValue: { fontSize: 14, color: '#111827', fontWeight: '600' },
  modalCloseButton: {
    marginTop: 12,
    backgroundColor: '#2563EB',
    paddingVertical: 10,
    borderRadius: 12,
    alignItems: 'center',
  },
  modalCloseButtonText: { color: '#FFF', fontWeight: '700', fontSize: 14 },
});

export default AllPlanDetails;
