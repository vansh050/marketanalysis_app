/**
 * BrokerDdpiHelpModal
 *
 * Reusable "How to activate DDPI on your broker" bottom-sheet. One component,
 * every broker. Pulls content from `src/config/brokerDdpiHelp.js` — do not
 * duplicate broker-specific copy inside this component.
 *
 * Usage:
 *   // 1. Direct prop (embedded in an existing screen):
 *   <BrokerDdpiHelpModal broker="Zerodha" visible={v} onClose={fn} />
 *
 *   // 2. Global modal store (works from anywhere):
 *   useModalStore.getState().openModal('DdpiHelp', { broker: 'Zerodha' });
 *
 * When the broker has online EDIS (Angel One, Dhan), the modal still pushes
 * DDPI via an additional "Why DDPI over EDIS?" callout — the config's
 * `hasOnlineEdis` flag toggles that block. EDIS works, but it's per-day and
 * flaky on third-party apps; DDPI is a one-time activation.
 *
 * Architecture doc: docs/BROKER_CONNECTION.md § DDPI/EDIS Help module.
 */

import React, {useState} from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Linking,
  Dimensions,
  Platform,
  ActivityIndicator,
  Pressable,
  BackHandler,
} from 'react-native';
import {WebView} from 'react-native-webview';
import {
  X as XIcon,
  ExternalLink,
  ShieldCheck,
  Info,
  ArrowLeft,
} from 'lucide-react-native';

import CrossPlatformOverlay from './CrossPlatformOverlay';
import {getBrokerDdpiHelp, EDIS_ALTERNATIVE_NUDGE} from '../config/brokerDdpiHelp';

const {height: screenHeight} = Dimensions.get('window');

// mailto:/tel:/whatsapp: URLs can't render in an in-app WebView — fall back
// to Linking for those, and only route http(s) into the embedded browser.
const openLinkSafely = url => {
  if (!url) return;
  Linking.openURL(url).catch(() => {
    // Silent — user can copy-paste. Link is also displayed as text fallback.
  });
};

const BrokerDdpiHelpModal = ({broker, visible, onClose}) => {
  const help = getBrokerDdpiHelp(broker);
  // Second overlay stacked above the help sheet. Closable via the back arrow;
  // keeps the user inside the app instead of bouncing out to Chrome (and
  // insulates against the DDPI URL rotting — a dead page lands in-app, not
  // mid-browser).
  const [webViewUrl, setWebViewUrl] = useState(null);
  const [webLoading, setWebLoading] = useState(false);

  // Graceful degrade for unknown brokers: render nothing instead of
  // crashing or showing a half-populated modal.
  if (!visible || !help) return null;

  const ctaUrl = help.directLink || help.portalUrl;
  const ctaLabel = help.directLink
    ? `Open ${broker}'s DDPI page`
    : help.portalUrl
      ? `Open ${broker}'s portal`
      : null;

  const handleCtaPress = () => {
    if (!ctaUrl) return;
    setWebLoading(true);
    setWebViewUrl(ctaUrl);
  };
  const closeWebView = () => setWebViewUrl(null);
  // Android hardware back: close the WebView first (if open), else close the
  // whole help modal. Without this, back press lands on the OS and the user
  // can't escape the stacked overlay, which is the "can't close it properly"
  // symptom that blocks the retry-sell path.
  React.useEffect(() => {
    if (!visible) return undefined;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (webViewUrl) {
        closeWebView();
        return true;
      }
      onClose?.();
      return true;
    });
    return () => sub.remove();
  }, [visible, webViewUrl, onClose]);

  return (
    <CrossPlatformOverlay visible={visible} onClose={onClose}>
      <View style={styles.container}>
        {/* Tap-outside backdrop closes the modal (only when WebView not open,
            otherwise a stray tap outside the card could strand the user). */}
        <Pressable
          style={StyleSheet.absoluteFillObject}
          onPress={() => {
            if (webViewUrl) return;
            onClose?.();
          }}
        />
        <View style={styles.sheet}>
          <View style={styles.headerRow}>
            <View style={styles.titleBlock}>
              <View style={styles.titleIconWrap}>
                <ShieldCheck size={20} color="#0a7a5a" />
              </View>
              <Text style={styles.title}>{help.title}</Text>
            </View>
            <TouchableOpacity
              onPress={onClose}
              hitSlop={{top: 8, bottom: 8, left: 8, right: 8}}
              style={styles.closeButton}>
              <XIcon size={22} color="#555" />
            </TouchableOpacity>
          </View>

          <ScrollView
            style={styles.scroll}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}>
            <Text style={styles.intro}>{help.intro}</Text>

            {help.hasOnlineEdis && (
              <View style={styles.edisCallout}>
                <Info size={16} color="#b66900" style={styles.edisIcon} />
                <View style={styles.edisTextBlock}>
                  <Text style={styles.edisCalloutTitle}>
                    Why DDPI even though {broker} has online EDIS?
                  </Text>
                  <Text style={styles.edisCalloutBody}>
                    {EDIS_ALTERNATIVE_NUDGE}
                  </Text>
                </View>
              </View>
            )}

            <Text style={styles.sectionHeader}>Steps</Text>
            <View style={styles.stepsList}>
              {help.steps.map((step, idx) => (
                <View key={idx} style={styles.stepRow}>
                  <Text style={styles.stepText}>{step}</Text>
                </View>
              ))}
            </View>

            {help.customerCare && (
              <View style={styles.customerCareBlock}>
                <Text style={styles.sectionHeader}>
                  If you get stuck, contact {broker}
                </Text>
                {help.customerCare.email && (
                  <TouchableOpacity
                    onPress={() =>
                      openLinkSafely(`mailto:${help.customerCare.email}`)
                    }>
                    <Text style={styles.careLink}>
                      Email: {help.customerCare.email}
                    </Text>
                  </TouchableOpacity>
                )}
                {help.customerCare.phone && (
                  <TouchableOpacity
                    onPress={() =>
                      openLinkSafely(`tel:${help.customerCare.phone}`)
                    }>
                    <Text style={styles.careLink}>
                      Phone: {help.customerCare.phone}
                    </Text>
                  </TouchableOpacity>
                )}
                {help.customerCare.whatsapp && (
                  <TouchableOpacity
                    onPress={() =>
                      openLinkSafely(
                        `https://wa.me/${help.customerCare.whatsapp.replace(/[^0-9]/g, '')}`,
                      )
                    }>
                    <Text style={styles.careLink}>
                      WhatsApp: {help.customerCare.whatsapp}
                    </Text>
                  </TouchableOpacity>
                )}
              </View>
            )}

            {/* Extra bottom padding so the scrollable content doesn't sit
                flush against the CTA when the user scrolls to end. */}
            <View style={{height: 16}} />
          </ScrollView>

          {ctaUrl && (
            <View style={styles.ctaBlock}>
              <TouchableOpacity
                style={styles.primaryCta}
                activeOpacity={0.8}
                onPress={handleCtaPress}>
                <Text style={styles.primaryCtaText}>{ctaLabel}</Text>
                <ExternalLink size={16} color="#fff" />
              </TouchableOpacity>
              <TouchableOpacity style={styles.secondaryCta} onPress={onClose}>
                <Text style={styles.secondaryCtaText}>I&apos;ll do this later</Text>
              </TouchableOpacity>
            </View>
          )}
          {!ctaUrl && (
            <View style={styles.ctaBlock}>
              <TouchableOpacity style={styles.primaryCta} onPress={onClose}>
                <Text style={styles.primaryCtaText}>Got it</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>

        {webViewUrl && (
          <View style={styles.webViewOverlay}>
            <View style={styles.webViewHeader}>
              <TouchableOpacity
                onPress={closeWebView}
                hitSlop={{top: 8, bottom: 8, left: 8, right: 8}}
                style={styles.webViewBack}>
                <ArrowLeft size={22} color="#111" />
              </TouchableOpacity>
              <Text style={styles.webViewTitle} numberOfLines={1}>
                {broker} — DDPI
              </Text>
              <TouchableOpacity
                onPress={() => openLinkSafely(webViewUrl)}
                hitSlop={{top: 8, bottom: 8, left: 8, right: 8}}
                style={styles.webViewIconButton}>
                <ExternalLink size={20} color="#0a7a5a" />
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => {
                  closeWebView();
                  onClose?.();
                }}
                hitSlop={{top: 8, bottom: 8, left: 8, right: 8}}
                style={styles.webViewIconButton}>
                <XIcon size={22} color="#111" />
              </TouchableOpacity>
            </View>
            <View style={styles.webViewBody}>
              <WebView
                source={{uri: webViewUrl}}
                onLoadStart={() => setWebLoading(true)}
                onLoadEnd={() => setWebLoading(false)}
                startInLoadingState
                javaScriptEnabled
                domStorageEnabled
                setSupportMultipleWindows={false}
                originWhitelist={['*']}
                userAgent={
                  Platform.OS === 'android'
                    ? 'Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36'
                    : undefined
                }
                renderLoading={() => (
                  <View style={styles.webViewLoader}>
                    <ActivityIndicator size="large" color="#0a7a5a" />
                  </View>
                )}
              />
              {webLoading && (
                <View style={styles.webViewLoaderOverlay} pointerEvents="none">
                  <ActivityIndicator size="small" color="#0a7a5a" />
                </View>
              )}
            </View>
          </View>
        )}
      </View>
    </CrossPlatformOverlay>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    padding: 16,
  },
  sheet: {
    backgroundColor: '#fff',
    borderRadius: 16,
    maxHeight: screenHeight * 0.85,
    width: '100%',
    maxWidth: 460,
    paddingTop: 14,
    // Android needs elevation for shadow + Pressable backdrop hit order to be right.
    elevation: 12,
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 6},
    shadowOpacity: 0.18,
    shadowRadius: 18,
    overflow: 'hidden',
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingBottom: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#eaeaea',
  },
  titleBlock: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  titleIconWrap: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#e5f7f0',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  title: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111',
    flexShrink: 1,
  },
  closeButton: {
    padding: 4,
  },
  scroll: {
    paddingHorizontal: 20,
  },
  scrollContent: {
    paddingTop: 14,
    paddingBottom: 8,
  },
  intro: {
    fontSize: 14,
    color: '#333',
    lineHeight: 20,
    marginBottom: 14,
  },
  edisCallout: {
    flexDirection: 'row',
    backgroundColor: '#fff7e6',
    borderColor: '#f0c36d',
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
  },
  edisIcon: {
    marginRight: 10,
    marginTop: 2,
  },
  edisTextBlock: {
    flex: 1,
  },
  edisCalloutTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#85571a',
    marginBottom: 4,
  },
  edisCalloutBody: {
    fontSize: 13,
    color: '#704614',
    lineHeight: 18,
  },
  sectionHeader: {
    fontSize: 13,
    fontWeight: '700',
    color: '#222',
    marginTop: 4,
    marginBottom: 8,
  },
  stepsList: {
    marginBottom: 16,
  },
  stepRow: {
    marginBottom: 6,
  },
  stepText: {
    fontSize: 13.5,
    color: '#333',
    lineHeight: 19,
  },
  customerCareBlock: {
    marginTop: 8,
    paddingTop: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#eaeaea',
  },
  careLink: {
    fontSize: 13,
    color: '#1d6be8',
    textDecorationLine: 'underline',
    marginBottom: 4,
  },
  ctaBlock: {
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: Platform.OS === 'ios' ? 24 : 16,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#eaeaea',
    backgroundColor: '#fff',
  },
  primaryCta: {
    flexDirection: 'row',
    backgroundColor: '#0a7a5a',
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  primaryCtaText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
  },
  secondaryCta: {
    paddingVertical: 10,
    alignItems: 'center',
  },
  secondaryCtaText: {
    color: '#666',
    fontSize: 13,
  },
  webViewOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    overflow: 'hidden',
  },
  webViewHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingTop: Platform.OS === 'ios' ? 14 : 12,
    paddingBottom: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#e5e5e5',
    backgroundColor: '#fafafa',
  },
  webViewBack: {
    padding: 4,
    marginRight: 10,
  },
  webViewTitle: {
    flex: 1,
    fontSize: 15,
    fontWeight: '700',
    color: '#111',
  },
  webViewExternal: {
    padding: 4,
    marginLeft: 10,
  },
  webViewIconButton: {
    padding: 4,
    marginLeft: 8,
  },
  webViewBody: {
    flex: 1,
  },
  webViewLoader: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fff',
  },
  webViewLoaderOverlay: {
    position: 'absolute',
    top: 12,
    right: 12,
  },
});

export default BrokerDdpiHelpModal;
