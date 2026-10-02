import React from 'react';
import {ActivityIndicator, FlatList, Image, RefreshControl, SafeAreaView, StyleSheet, Text, TouchableOpacity, View} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import {ChevronLeft, ChevronRight, Crown} from 'lucide-react-native';

import {designColor, designFont} from '../../../src/design/literalTokens';

const fallbackImage = require('../../../src/assets/alpha-100.png');

const MySubscriptionsScreen = ({viewModel, actions}) => {
  const {
    gradient1,
    gradient2,
    mainColor,
    activeColor,
    cardElevation,
    cardBorderWidth,
    cardVerticalMargin,
    bespokePlanLabel,
    activeSubTab,
    mpCount,
    bespokeCount,
    loading,
    refreshing,
    planCards,
  } = viewModel;

  const renderCard = ({item}) => (
    <TouchableOpacity onPress={() => actions.onOpenPlan(item.plan)} activeOpacity={0.7} style={{marginBottom: cardVerticalMargin}}>
      <LinearGradient
        colors={[gradient1, gradient2]}
        start={{x: 0, y: 0}}
        end={{x: 1, y: 0}}
        style={[styles.card, {elevation: cardElevation, borderWidth: cardBorderWidth, borderColor: 'rgba(255,255,255,0.15)'}]}>
        <View style={styles.cardContent}>
          <View style={styles.cardImageContainer}>
            <Image source={item.imageSource || fallbackImage} style={styles.cardImage} />
          </View>
          <View style={styles.cardInfo}>
            <Text style={styles.cardTitle} numberOfLines={1}>{item.name}</Text>
            <Text style={styles.cardExpiry}>Expires: {item.expiry}</Text>
            {item.started ? <Text style={styles.cardExpiry}>Active since: {item.started}</Text> : null}
            {item.isRenew && <Text style={styles.renewText}>Expires in {item.daysLeft} day{item.daysLeft !== 1 ? 's' : ''}</Text>}
          </View>
          <View style={styles.cardRight}>
            <View style={[styles.statusBadge, {backgroundColor: item.isRenew ? 'rgba(255, 193, 7, 0.25)' : `${activeColor}30`}]}>
              <Text style={[styles.statusText, {color: item.isRenew ? designColor('ffd54f') : activeColor}]}>{item.isRenew ? 'Expiring Soon' : 'Active'}</Text>
            </View>
            <ChevronRight size={18} color="rgba(255,255,255,0.6)" />
          </View>
        </View>
      </LinearGradient>
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.container}>
      <LinearGradient colors={[gradient1, gradient2]} start={{x: 0, y: 0}} end={{x: 1, y: 0}} style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={actions.onBack}>
          <ChevronLeft size={24} color={designColor('000')} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>My Subscriptions</Text>
      </LinearGradient>
      {!loading && (
        <View style={styles.tabRow}>
          <TouchableOpacity style={[styles.subTab, activeSubTab === 'mp' && {backgroundColor: mainColor}]} onPress={() => actions.onTabChange('mp')}>
            <Text style={[styles.subTabText, activeSubTab === 'mp' && styles.subTabTextActive]}>Model Portfolios ({mpCount})</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.subTab, activeSubTab === 'bespoke' && {backgroundColor: mainColor}]} onPress={() => actions.onTabChange('bespoke')}>
            <Text style={[styles.subTabText, activeSubTab === 'bespoke' && styles.subTabTextActive]}>{bespokePlanLabel} ({bespokeCount})</Text>
          </TouchableOpacity>
        </View>
      )}
      {loading ? (
        <View style={styles.loaderContainer}><ActivityIndicator size="large" color={mainColor} /></View>
      ) : planCards.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Crown size={48} color={mainColor} />
          <Text style={styles.emptyTitle}>{activeSubTab === 'mp' ? 'No Model Portfolio Subscriptions' : `No ${bespokePlanLabel.replace(/ Plans$/, '')} Subscriptions`}</Text>
          <Text style={styles.emptySubtitle}>{activeSubTab === 'mp' ? "You haven't subscribed to any model portfolios yet." : `You haven't subscribed to any ${bespokePlanLabel.toLowerCase()} yet.`}</Text>
          <TouchableOpacity style={[styles.browsePlansButton, {backgroundColor: mainColor}]} onPress={actions.onBrowsePlans}>
            <Text style={styles.browsePlansText}>Browse Plans</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={planCards}
          keyExtractor={(item, index) => item.id || index.toString()}
          renderItem={renderCard}
          contentContainerStyle={styles.listContent}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={actions.onRefresh} tintColor={mainColor} />}
        />
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {flex: 1, backgroundColor: designColor('f5f5f5')},
  header: {flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 16},
  backButton: {padding: 4, borderRadius: 5, backgroundColor: designColor('fff'), marginRight: 12},
  headerTitle: {fontSize: 18, fontFamily: designFont('Poppins-Medium'), color: designColor('fff')},
  loaderContainer: {flex: 1, justifyContent: 'center', alignItems: 'center'},
  emptyContainer: {flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 40},
  emptyTitle: {fontSize: 18, fontFamily: designFont('Poppins-SemiBold'), color: designColor('333'), marginTop: 16},
  emptySubtitle: {fontSize: 13, fontFamily: designFont('Poppins-Regular'), color: designColor('888'), textAlign: 'center', marginTop: 8},
  browsePlansButton: {marginTop: 24, paddingVertical: 10, paddingHorizontal: 24, borderRadius: 6},
  browsePlansText: {color: designColor('fff'), fontSize: 14, fontFamily: designFont('Poppins-Medium')},
  listContent: {padding: 16},
  card: {borderRadius: 8, shadowColor: designColor('000'), shadowOffset: {width: 0, height: 2}, shadowOpacity: 0.15, shadowRadius: 8},
  cardContent: {flexDirection: 'row', alignItems: 'center', padding: 14},
  cardImageContainer: {backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: 8, marginRight: 12},
  cardImage: {width: 40, height: 40, borderRadius: 8},
  cardInfo: {flex: 1},
  cardTitle: {fontSize: 14, fontFamily: designFont('Poppins-SemiBold'), color: designColor('fff')},
  cardExpiry: {fontSize: 11, fontFamily: designFont('Poppins-Regular'), color: 'rgba(255,255,255,0.7)', marginTop: 2},
  renewText: {fontSize: 11, fontFamily: designFont('Poppins-Medium'), color: designColor('ffd54f'), marginTop: 2},
  cardRight: {alignItems: 'center', gap: 6},
  statusBadge: {paddingHorizontal: 8, paddingVertical: 3, borderRadius: 4},
  statusText: {fontSize: 10, fontFamily: designFont('Poppins-Medium')},
  tabRow: {flexDirection: 'row', paddingHorizontal: 16, paddingTop: 14, paddingBottom: 6, gap: 10},
  subTab: {flex: 1, height: 36, borderRadius: 6, alignItems: 'center', justifyContent: 'center', backgroundColor: designColor('e8e8e8')},
  subTabText: {fontSize: 12, fontFamily: designFont('Poppins-Medium'), color: designColor('555')},
  subTabTextActive: {color: designColor('fff')},
});

export default MySubscriptionsScreen;
