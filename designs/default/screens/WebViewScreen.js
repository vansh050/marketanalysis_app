import React from 'react';
import {
  View,
  ActivityIndicator,
  StyleSheet,
  TouchableOpacity,
  Text,
} from 'react-native';
import WebView from 'react-native-webview';
import LinearGradient from 'react-native-linear-gradient';
import {ChevronLeft} from 'lucide-react-native';

import useTokens from '../../../src/theme/useTokens';

import {designColor, designFont} from '../../../src/design/literalTokens';

const WebViewScreen = ({viewModel, actions}) => {
  const tokens = useTokens();
  const {pageUrl, pageTitle} = viewModel;

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={[
          tokens.colors.brand.gradientStart,
          tokens.colors.brand.gradientEnd,
        ]}
        start={{x: 0, y: 0}}
        end={{x: 1, y: 0}}
        style={styles.header}>
        <TouchableOpacity
          accessibilityRole="button"
          accessibilityLabel="Go back"
          style={styles.backButton}
          onPress={actions.onBack}>
          <ChevronLeft size={23} color={designColor('ffffff')} />
        </TouchableOpacity>
        <Text numberOfLines={1} style={styles.headerTitle}>
          {pageTitle}
        </Text>
        <View style={styles.headerSpacer} />
      </LinearGradient>
      <WebView
        source={{ uri: pageUrl }}
        onNavigationStateChange={actions.onNavigationStateChange}
        startInLoadingState={true}
        setSupportMultipleWindows={false}
        renderLoading={() => (
          <View style={styles.loadingContainer}>
            <ActivityIndicator
              size="large"
              color={tokens.colors.brand.primary}
            />
            <Text style={styles.loadingText}>Loading {pageTitle}…</Text>
          </View>
        )}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    minHeight: 52,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
  },
  backButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    flex: 1,
    color: designColor('ffffff'),
    fontFamily: designFont('Poppins-SemiBold'),
    fontSize: 16,
    textAlign: 'center',
  },
  headerSpacer: {
    width: 40,
  },
  loadingContainer: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: designColor('ffffff'),
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    color: designColor('4b5563'),
    fontFamily: designFont('Poppins-Regular'),
    fontSize: 12,
    marginTop: 10,
  },
});

export default WebViewScreen;
