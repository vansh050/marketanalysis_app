import React from 'react';
import {View, Text, StyleSheet, TouchableOpacity, Image, ScrollView, RefreshControl} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import LinearGradient from 'react-native-linear-gradient';
import {ChevronLeft, Pencil} from 'lucide-react-native';
import {FadeLoading} from 'react-native-fade-loading';

import {designColor, designFont} from '../../../src/design/literalTokens';

const cross = require('../../../src/assets/cross.png');
const tick = require('../../../src/assets/checked.png');

const SubscriptionScreen = ({viewModel, actions, slots}) => {
  const {
    gradient1, gradient2, loading, brokerStatus, userDetails, broker,
    userEmail, themeColor, cashText, cashVerification, refreshing,
  } = viewModel;
  const {
    onBack, onRefresh, openManageConnections, handleOpen,
    setShowDisconnectBroker, getPrimaryBrokerEntry, isBrokerSessionExpired,
  } = actions;
  const ThinkingIllustration = slots.ThinkingIllustration;
  // Top inset is already painted by App.js CustomStatusBar; adding it here
  // too left a status-bar-tall white band above the header (2026-10-02).
  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      {/* Header */}
      <LinearGradient
        colors={[gradient1, gradient2]}
        start={{ x: 0, y: 0 }}
        end={{ x: 0, y: 1 }}
        style={styles.headerGradient}>
        <View style={styles.headerRow}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={onBack}
            activeOpacity={0.7}>
            <ChevronLeft size={24} color={designColor('004a94')} />
          </TouchableOpacity>
          <View>
            <Text style={styles.headerTitle}>Broker Screen</Text>
            <Text style={styles.headerSubtitle}>
              You can connect to Brokers here
            </Text>
          </View>
        </View>
      </LinearGradient>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={designColor('004a94')}
          />
        }>
        {/* Broker Connection Status */}
        <View style={styles.statusContainer}>
          {loading ? (
            <FadeLoading
              style={styles.loadingBar}
              primaryColor={designColor('f0f0f0')}
              secondaryColor={designColor('e0e0e0')}
              duration={500}
            />
          ) : !(
            !brokerStatus ||
            brokerStatus === null ||
            brokerStatus === 'Disconnected'
          ) ? (
            // Primary is set — but its session may be expired even if
            // the top-level connect_broker_status still says connected.
            // Check the actual primary entry's status + token_expire.
            ((() => {
              const primaryEntry = getPrimaryBrokerEntry(userDetails);
              const primaryExpired = isBrokerSessionExpired(primaryEntry);
              if (primaryExpired) {
                return (
                  <View style={styles.expiredContainer}>
                    <View style={styles.errorMessage}>
                      <Image source={cross} style={styles.crossIcon} />
                      <View>
                        <Text style={styles.brokerExpiredText}>
                          {broker} Session Expired
                        </Text>
                        <Text style={styles.brokerSubDisText}>{userEmail}</Text>
                      </View>
                    </View>
                    <TouchableOpacity
                      style={[styles.changeButtonDis, {borderColor: designColor('f59e0b')}]}
                      onPress={openManageConnections}
                      activeOpacity={0.8}>
                      <Text style={[styles.changeButtonTextDis, {color: designColor('f59e0b')}]}>Re-auth</Text>
                    </TouchableOpacity>
                  </View>
                );
              }
              return (
                <LinearGradient
                  colors={[gradient1, gradient2]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.brokerStatusCard}>
                  <View style={styles.brokerStatusContent}>
                    <View style={styles.brokerStatusLeft}>
                      <Image source={tick} style={styles.statusIcon} />
                      <View>
                        <Text style={styles.brokerConnectedText}>
                          {broker} Broker Connected
                        </Text>
                        <Text style={styles.brokerSubText}>{userEmail}</Text>
                      </View>
                    </View>
                    <TouchableOpacity
                      style={styles.changeButton}
                      onPress={handleOpen}
                      activeOpacity={0.8}>
                      <Pencil size={14} color={designColor('fff')} />
                    </TouchableOpacity>
                  </View>
                </LinearGradient>
              );
            })())
          ) : (
            <View style={styles.errorContainer}>
              <View style={styles.errorMessage}>
                <Image source={cross} style={styles.crossIcon} />
                <View>
                  <Text style={styles.brokerDisconnectedText}>
                    Broker Disconnected
                  </Text>
                  <Text style={styles.brokerSubDisText}>{userEmail}</Text>
                </View>
              </View>
              <TouchableOpacity
                style={[styles.changeButtonDis, {borderColor: themeColor}]}
                onPress={handleOpen}
                activeOpacity={0.8}>
                <Text style={[styles.changeButtonTextDis, {color: themeColor}]}>Connect Broker</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>

        {/* Broker & Funds Info Card.
            Pre-2026-05-01 wrapped these rows in a <LinearGradient>;
            user-reported on a real Android phone after connecting
            Dhan that the title rendered but every row below was
            invisible (zero height in the gradient subtree).
            react-native-linear-gradient v3 has known Android cases
            where multiple Text children inside the gradient lose
            measurement when LinearGradient's native view is mounted
            before its children's text has loaded, leaving the rows
            sized to 0. Switched to a plain View with the solid
            darker-end of the same gradient as backgroundColor —
            decorative-only difference, robust on every device. */}
        <View style={styles.infoCard}>
          <Text style={styles.infoCardTitle}>Your Broker & Funds Info</Text>

          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Broker:</Text>
            <Text style={styles.infoValue}>
              {userDetails?.user_broker || 'N/A'}
            </Text>
          </View>

          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Available Cash:</Text>
            <View style={styles.infoValueGroup}>
              <Text style={[styles.infoValue, styles.infoValueInGroup]}>
                {cashText}
              </Text>
              {!!cashVerification && (
                <Text style={styles.infoMeta}>{cashVerification}</Text>
              )}
            </View>
          </View>

          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Phone:</Text>
            <Text style={styles.infoValue}>
              {userDetails?.phone_number || 'N/A'}
            </Text>
          </View>

          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Email:</Text>
            <Text style={styles.infoValue}>{userDetails?.email || 'N/A'}</Text>
          </View>

          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>PAN:</Text>
            <Text style={styles.infoValue}>
              {userDetails?.panNumber || 'N/A'}
            </Text>
          </View>

          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Account Created:</Text>
            <Text style={styles.infoValue}>
              {userDetails?.created_at
                ? new Date(userDetails.created_at).toLocaleDateString('en-IN', {
                  year: 'numeric',
                  month: 'short',
                  day: 'numeric',
                })
                : 'N/A'}
            </Text>
          </View>
        </View>
      </ScrollView>
      {/* Manage Connections visible whenever the user has ANY saved broker
          credentials, not just when the primary session is active.
          brokerStatus='Disconnected' only means no active primary — the
          user may still have other brokers in connected_brokers[] whose
          sessions/credentials we want to expose for Re-auth / Remove.
          Mirrors web /subscriptions which lists every connected_brokers[]
          entry regardless of primary status. Disconnect button still
          gated on an active primary since it only makes sense then. */}
      {(userDetails?.connected_brokers || []).some(
        b => b?.broker && b.broker !== 'DummyBroker',
      ) && (
          <View style={styles.buttonRow}>
            <TouchableOpacity
              style={[styles.button, styles.manageButton]}
              onPress={openManageConnections}
              activeOpacity={0.8}>
              <Text style={styles.manageButtonText}>Manage Connections</Text>
            </TouchableOpacity>
            {!(
              !brokerStatus ||
              brokerStatus === null ||
              brokerStatus === 'Disconnected'
            ) && (
                <TouchableOpacity
                  style={[styles.button, styles.disconnectButton]}
                  onPress={() => setShowDisconnectBroker(true)}
                  activeOpacity={0.8}>
                  <Text style={styles.disconnectText}>Disconnect</Text>
                </TouchableOpacity>
              )}
          </View>
        )}
      {/* Bottom doodle & info section */}
      <View style={styles.bottomDoodleContainer}>
        {/* Example doodle shape, you can replace with an SVG or Image */}
        <View style={styles.doodleShape}>
          <ThinkingIllustration width="100%" height="100%" />
        </View>
        <View style={styles.doodleContent}>
          <Text style={styles.doodleTitle}>Did You Know?</Text>
          <Text style={styles.doodleText}>
            Connecting your broker helps you manage investments seamlessly and
            stay updated with your portfolio.
          </Text>
        </View>
      </View>
      {slots.Modals}
    </SafeAreaView>
  );
};
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: designColor('f0f0f0'),
  },
  scrollContent: {
    paddingBottom: 150, // Space for "Did You Know?" section at bottom
    flexGrow: 1,
  },
  button: {
    // No fixed width — buttons sit inside `buttonRow` (flexDirection:
    // row + paddingHorizontal:20) and the composed `manageButton` /
    // `disconnectButton` set `flex: 1` which overrides any width
    // here. The prior `screenWidth - 100` was dead code *and* made
    // the screen vulnerable to the frozen-Dimensions distortion on
    // foldables/split-screen.
    paddingVertical: 10,
    borderRadius: 8,
    alignContent: 'center',
    alignSelf: 'center',
    alignItems: 'center',
  },
  headerGradient: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 18,
    borderBottomLeftRadius: 18,
    borderBottomRightRadius: 18,
    elevation: 4,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  backButton: {
    padding: 6,
    borderRadius: 8,
    backgroundColor: designColor('fff'),
    marginRight: 14,
    elevation: 3,
  },
  headerTitle: {
    fontSize: 18,
    fontFamily: designFont('Poppins-Medium'),
    color: designColor('fff'),
    marginBottom: 0,
  },
  buttonRow: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    gap: 12,
    marginBottom: 20,
  },
  manageButton: {
    flex: 1,
    backgroundColor: designColor('0056b7'),
  },
  manageButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: designColor('fff'),
  },
  disconnectButton: {
    flex: 1,
    backgroundColor: designColor('dc2626'),
  },
  disconnectText: {
    fontSize: 14,
    fontWeight: '600',
    color: designColor('fff'),
  },
  headerSubtitle: {
    fontSize: 12,
    fontFamily: designFont('Poppins-Regular'),
    color: designColor('d9e4f5'),
  },
  statusContainer: {
    marginHorizontal: 20,
    marginTop: 24,
  },
  loadingBar: {
    // `alignSelf: 'stretch'` fills the parent (`statusContainer` has
    // `marginHorizontal: 20`) at live width instead of the frozen
    // `screenWidth - 60`, which broke on foldables / split-screen.
    alignSelf: 'stretch',
    height: 20,
    borderRadius: 8,
  },
  brokerStatusCard: {
    borderRadius: 6,
    paddingVertical: 18,
    paddingHorizontal: 20,
    elevation: 6,
    shadowColor: designColor('1a3bff'),
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.25,
    shadowRadius: 12,
  },
  brokerStatusContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  brokerStatusLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statusIcon: {
    width: 28,
    height: 28,
    marginRight: 14,
  },
  brokerConnectedText: {
    fontSize: 12,
    color: designColor('fff'),
    fontFamily: designFont('Poppins-Medium'),
  },
  brokerDisconnectedText: {
    fontSize: 12,
    color: designColor('090909ff'),
    fontFamily: designFont('Poppins-Medium'),
  },
  brokerSubText: {
    fontSize: 12,
    color: designColor('cfe4ff'),
    marginTop: 2,
    fontFamily: designFont('Satoshi-Regular'),
  },
  brokerSubDisText: {
    fontSize: 12,
    color: designColor('575859ff'),
    marginTop: 2,
    fontFamily: designFont('Satoshi-Regular'),
  },
  changeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: designColor('fff'),
  },
  changeButtonText: {
    color: designColor('fff'),
    fontSize: 12,
    fontFamily: designFont('Poppins-Regular'),
  },
  changeButtonDis: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: designColor('0056b7'),
  },
  changeButtonTextDis: {
    color: designColor('0056b7'),
    fontSize: 10,
    fontFamily: designFont('Poppins-Regular'),
  },
  errorContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    padding: 14,
    borderRadius: 16,
    backgroundColor: designColor('fce9eb'),
    elevation: 3,
    shadowColor: designColor('d45'),
    shadowOpacity: 0.22,
    shadowRadius: 4,
  },
  expiredContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 14,
    borderRadius: 16,
    backgroundColor: designColor('fef3c7'),
    elevation: 3,
    shadowColor: designColor('f59e0b'),
    shadowOpacity: 0.22,
    shadowRadius: 4,
  },
  brokerExpiredText: {
    fontSize: 14,
    color: designColor('92400e'),
    fontFamily: designFont('Poppins-Medium'),
  },
  errorMessage: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  crossIcon: {
    width: 32,
    height: 32,
    marginRight: 12,
  },
  errorTitle: {
    fontSize: 15,
    fontFamily: designFont('Poppins-SemiBold'),
    color: designColor('a92327'),
  },
  errorSubtitle: {
    fontSize: 12,
    color: designColor('7e7e7e'),
    marginTop: 2,
    fontFamily: designFont('Satoshi-Regular'),
  },
  connectButton: {
    backgroundColor: designColor('000'),
    borderRadius: 6,
    paddingVertical: 8,
    paddingHorizontal: 18,
    justifyContent: 'center',
  },
  connectButtonText: {
    color: designColor('fff'),
    fontSize: 13,
    fontFamily: designFont('Poppins-SemiBold'),
    textAlign: 'center',
  },
  infoCard: {
    marginHorizontal: 20,
    marginTop: 30,
    borderRadius: 6,
    paddingVertical: 22,
    paddingHorizontal: 25,
    // Solid backgroundColor — same darker end of the original
    // [gradient1, gradient2] pair the LinearGradient used. Switched
    // away from LinearGradient 2026-05-01 after the on-device
    // rows-invisible bug.
    backgroundColor: designColor('002651'),
    elevation: 8,
    shadowColor: designColor('2a4bd7'),
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
  },
  infoCardTitle: {
    fontSize: 18,
    fontFamily: designFont('Satoshi-Bold'),
    color: 'white',
    marginBottom: 16,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  infoLabel: {
    fontSize: 14,
    fontFamily: designFont('Satoshi-Medium'),
    color: designColor('d1d9ff'),
  },
  infoValue: {
    fontSize: 14,
    fontFamily: designFont('Satoshi-Regular'),
    color: 'white',
    maxWidth: '55%',
    textAlign: 'right',
  },
  // Percentage widths compounded here: `infoValue` caps itself at 55% of its
  // parent, and nesting it inside a group that was itself 55% of the row left
  // the value ~a third of the row, breaking "\u20b9 1022.79" across three lines
  // on a real device (user-reported 2026-09-02). The group now simply takes
  // the row's remaining width, and the value inside it drops its own cap.
  infoValueGroup: {
    flex: 1,
    flexShrink: 1,
    marginLeft: 12,
    alignItems: 'flex-end',
  },
  infoValueInGroup: {
    maxWidth: '100%',
  },
  infoMeta: {
    marginTop: 2,
    fontSize: 11,
    fontFamily: designFont('Satoshi-Regular'),
    color: designColor('d1d9ff'),
    textAlign: 'right',
  },

  /* Bottom doodle & info styles */
  bottomDoodleContainer: {
    backgroundColor: designColor('e6f0fa'),
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    paddingVertical: 18,
    paddingHorizontal: 24,
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 12,
    elevation: 10,
    shadowColor: designColor('aed0f7'),
    shadowRadius: 20,
    shadowOpacity: 0.6,
    shadowOffset: { width: 0, height: -5 },
  },
  doodleShape: {
    width: 80,
    height: 80,
    backgroundColor: designColor('6494ed65'),
    borderRadius: 40,
    marginRight: 18,
  },
  doodleContent: {
    flex: 1,
  },
  doodleTitle: {
    fontSize: 18,
    fontFamily: designFont('Poppins-Bold'),
    color: designColor('214eac'),
    marginBottom: 6,
  },
  doodleText: {
    fontSize: 13,
    fontFamily: designFont('Poppins-Regular'),
    color: designColor('4f5e7d'),
    marginBottom: 8,
  },
  doodleInfo: {
    fontSize: 14,
    fontFamily: designFont('Poppins-Medium'),
    color: designColor('2f3e6b'),
  },
});

export default SubscriptionScreen;
