/**
 * ModelPortfolioScreen — design-system screen presentation (Phase I, 2026-05-02)
 *
 * Pure presentation. Container owns useTrade, useConfig, useNavigation,
 * Firebase getAuth, axios (5+ endpoints: bespoke, strategy, strategyDetails,
 * specificPlan, subscriptionData), TabView state, modal state (payment,
 * success, recommendation), RefreshControl.
 *
 * Contract:
 *   viewModel = {
 *     // theme
 *     gradient1, gradient2, mainColor,
 *     // tab state
 *     tabIndex,              // number
 *     routes,                // [{ key, title }]
 *     isSingleListType,      // boolean — type is one of the singleListTypes
 *     // modal
 *     modalVisible,          // boolean — plan detail modal
 *     selectedPlan,          // object | null — plan shown in detail modal
 *     // flags
 *     showHeader,            // boolean — show gradient header (!(type === 'tab'))
 *     width,                 // number — screen width for RenderHTML contentWidth
 *   }
 *   actions = {
 *     onGoBack,              // () => void
 *     onTabIndexChange,      // (index: number) => void
 *     onCloseModal,          // () => void — close plan detail modal
 *   }
 *   slots = {
 *     TabBarSlot,            // (props) => ReactElement — CustomTabBar
 *     MPListSlot,            // () => ReactElement — renderMPList FlatList
 *     BespokeListSlot,       // () => ReactElement — renderBespokeList FlatList
 *     InvestNowModalSlot,    // ReactElement | null — <MPInvestNowModal>
 *     PaymentSuccessSlot,    // ReactElement | null — <PaymentSuccessModal>
 *     RecommendationSuccessSlot, // ReactElement | null — <RecommendationSuccessModal>
 *   }
 */

import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
  SafeAreaView,
  Modal,
  ScrollView,
} from 'react-native';
import { ChevronLeft, GitForkIcon } from 'lucide-react-native';
import { TabView } from 'react-native-tab-view';
import RenderHTML from 'react-native-render-html';
import LinearGradient from 'react-native-linear-gradient';

const { width: ScreenWidth } = Dimensions.get('window');

const ModelPortfolioScreen = ({ viewModel, actions, slots }) => {
  const {
    gradient1 = 'rgba(0, 86, 183, 1)',
    gradient2 = 'rgba(0, 38, 81, 1)',
    mainColor = '#2563EB',
    tabIndex = 0,
    routes = [],
    isSingleListType = false,
    modalVisible = false,
    selectedPlan = null,
    showHeader = true,
    width = ScreenWidth,
  } = viewModel || {};

  const {
    onGoBack = () => {},
    onTabIndexChange = () => {},
    onCloseModal = () => {},
  } = actions || {};

  const {
    TabBarSlot,
    MPListSlot,
    BespokeListSlot,
    InvestNowModalSlot = null,
    PaymentSuccessSlot = null,
    RecommendationSuccessSlot = null,
  } = slots || {};

  const renderScene = ({ route }) => {
    if (route.key === 'modelportfolio' && MPListSlot) return MPListSlot();
    if (route.key === 'bespoke' && BespokeListSlot) return BespokeListSlot();
    return null;
  };

  // Plan detail modal (shared between single-list and full views)
  const renderPlanDetailModal = () => (
    <Modal
      visible={modalVisible}
      transparent
      animationType="slide"
      onRequestClose={onCloseModal}
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

          <ScrollView
            style={styles.modalContent}
            showsVerticalScrollIndicator={false}
          >
            {/* Advisor */}
            <View style={styles.infoCard}>
              <Text style={styles.infoLabel}>Advisor</Text>
              <Text style={styles.infoValue}>{selectedPlan?.advisor}</Text>
            </View>

            {/* Invested / Minimum Investment */}
            {(selectedPlan?.subscription?.amount || selectedPlan?.minInvestment) ? (
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
            {(selectedPlan?.subscription?.end_date || selectedPlan?.duration) ? (
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
                  contentWidth={width - 64}
                  source={{ html: selectedPlan.description }}
                  baseStyle={styles.infoValue}
                />
              </View>
            )}

            {/* Onetime Options */}
            {selectedPlan?.onetimeOptions?.length > 0 && (
              <View style={styles.infoCard}>
                <Text style={[styles.infoLabel, { marginBottom: 8 }]}>
                  Onetime Options
                </Text>
                {selectedPlan.onetimeOptions.map((opt, index) => (
                  <View key={index} style={styles.optionRow}>
                    <Text style={styles.optionLabel}>
                      {opt.label || `${opt.duration} Days`}
                    </Text>
                    <Text style={styles.optionValue}>{'₹'} {opt.amount}</Text>
                  </View>
                ))}
              </View>
            )}

            {/* Recurring / Frequency Options */}
            {selectedPlan?.frequency?.length > 0 && (
              <View style={styles.infoCard}>
                <Text style={[styles.infoLabel, { marginBottom: 8 }]}>
                  Recurring Options
                </Text>
                {selectedPlan.frequency.map((freq, index) => {
                  const price = selectedPlan.pricing?.[freq];
                  return (
                    <View key={index} style={styles.optionRow}>
                      <Text style={styles.optionLabel}>
                        {freq.charAt(0).toUpperCase() + freq.slice(1)}
                      </Text>
                      <Text style={styles.optionValue}>
                        {price && Number(price) > 0 ? `₹ ${price}` : 'N/A'}
                      </Text>
                    </View>
                  );
                })}
              </View>
            )}
          </ScrollView>

          {/* Close Button */}
          <TouchableOpacity
            onPress={onCloseModal}
            style={[styles.modalCloseButton, { backgroundColor: mainColor }]}
          >
            <Text style={styles.modalCloseButtonText}>Close</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );

  // Single-list mode (horizontal/vertical MP or Bespoke only)
  if (isSingleListType) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: 'transparent' }}>
        {MPListSlot ? MPListSlot() : BespokeListSlot ? BespokeListSlot() : null}
        {InvestNowModalSlot}
        {RecommendationSuccessSlot}
        {PaymentSuccessSlot}
        {renderPlanDetailModal()}
      </SafeAreaView>
    );
  }

  // Full screen with tabs
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#FBFBFB' }}>
      {showHeader && (
        <LinearGradient
          colors={[gradient1, gradient2]}
          start={{ x: 0, y: 0 }}
          end={{ x: 0, y: 1 }}
          style={styles.headerGradient}
        >
          <View style={styles.headerRow}>
            <TouchableOpacity style={styles.backButton} onPress={onGoBack}>
              <ChevronLeft size={24} color="#000" />
            </TouchableOpacity>
            <View style={{ justifyContent: 'center' }}>
              <Text style={styles.headerTitle}>Plans</Text>
            </View>
          </View>
          <View style={{ marginLeft: 45, marginTop: 2 }}>
            <Text style={styles.headerSubtitle}>
              You can subscribe to 1 or more Plans
            </Text>
          </View>
        </LinearGradient>
      )}

      {routes.length === 0 ? (
        <View style={styles.emptyContainer}>
          <View style={styles.iconWrapper}>
            <GitForkIcon size={60} color="#6B7280" />
          </View>
          <View style={styles.textWrapper}>
            <Text style={styles.emptyTitle}>No Plans Available</Text>
            <Text style={styles.emptySubtitle}>
              When your advisor creates a plan, it will appear here.
            </Text>
          </View>
        </View>
      ) : (
        <TabView
          navigationState={{ index: tabIndex, routes }}
          renderScene={renderScene}
          onIndexChange={onTabIndexChange}
          initialLayout={{ width }}
          renderTabBar={TabBarSlot ? (props) => TabBarSlot(props) : undefined}
        />
      )}

      {InvestNowModalSlot}
      {RecommendationSuccessSlot}
      {PaymentSuccessSlot}
      {renderPlanDetailModal()}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  headerGradient: {
    paddingHorizontal: 15,
    paddingVertical: 10,
    borderBottomLeftRadius: 15,
    borderBottomRightRadius: 15,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 10,
  },
  backButton: {
    padding: 4,
    borderRadius: 5,
    backgroundColor: '#fff',
    marginRight: 10,
  },
  headerTitle: {
    fontSize: 20,
    fontFamily: 'Poppins-Medium',
    color: '#fff',
  },
  headerSubtitle: {
    fontSize: 12,
    fontFamily: 'Poppins-Regular',
    color: '#f0f0f0',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 20,
    paddingHorizontal: 20,
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    marginHorizontal: 20,
    width: ScreenWidth - 40,
    marginTop: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  iconWrapper: {
    marginBottom: 20,
    backgroundColor: '#E5E7EB',
    borderRadius: 50,
    padding: 10,
  },
  textWrapper: {
    alignItems: 'center',
  },
  emptyTitle: {
    fontSize: 14,
    fontFamily: 'Poppins-SemiBold',
    color: '#111827',
    textAlign: 'center',
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 14,
    fontFamily: 'Poppins-Medium',
    color: '#6B7280',
    textAlign: 'center',
    lineHeight: 20,
  },
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
  infoLabel: {
    fontSize: 12,
    fontWeight: '500',
    color: '#6B7280',
    marginBottom: 4,
  },
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

export default ModelPortfolioScreen;
