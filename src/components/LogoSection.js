// src/components/LogoSection.js
import React from 'react';
import {View, Text, Image, StyleSheet, Dimensions} from 'react-native';
import Config from '../utils/safeConfig';
import {useConfig} from '../context/ConfigContext';
import APP_VARIANTS from '../utils/Config';
import useTokens from '../theme/useTokens';
const screenWidth = Dimensions.get('window').width;

const LogoSection = () => {
  const config = useConfig();
  const tokens = useTokens();
  const selectedVariant = Config?.APP_VARIANT || 'rgxresearch';
  const validVariant = APP_VARIANTS[selectedVariant] ? selectedVariant : 'rgxresearch';
  const fallbackConfig = APP_VARIANTS[validVariant] || {};

  // Advisor-provided logo (URL / require / SVG fn) wins. When absent — e.g.
  // the alphanomy variant nulls out `logo`/`toolbarlogo` so it never leaks
  // the AlphaQuark/Zamzam PNG — fall back to the variant's brand-mark asset
  // token (default = AlphaQuark logo, alphanomy = its own PNG). No variant
  // name hardcoded here. See docs/DESIGN_SYSTEM_ARCHITECTURE.md § Variant assets.
  const logo = config?.logo || fallbackConfig.logo || tokens?.assets?.logoPng;
  const themeColor = config?.themeColor || fallbackConfig.themeColor;
  const appName = Config.REACT_APP_WHITE_LABEL_TEXT;

  // Render logo based on type: URL string, function (SVG component), or require() object
  const renderLogo = () => {
    if (!logo) {
      return null;
    }

    // URL string from API
    if (typeof logo === 'string') {
      return (
        <Image
          source={{uri: logo}}
          style={{width: screenWidth * 0.65, height: 80, resizeMode: 'contain'}}
        />
      );
    }

    // SVG component (function)
    if (typeof logo === 'function') {
      const LogoComponent = logo;
      return <LogoComponent width={screenWidth * 0.65} height={80} />;
    }

    // require() object (PNG/JPG)
    return (
      <Image
        source={logo}
        style={{width: screenWidth * 0.65, height: 80, resizeMode: 'contain'}}
      />
    );
  };

  return (
    <View style={styles.containerLogo}>
      {renderLogo()}

      <Text style={styles.subtitle}>Invest with {appName}</Text>
      <Text
        style={{
          fontSize: 13,
          textAlign: 'center',
          marginBottom: 20,
          color: '#9ca2ae',
          fontFamily: 'Satoshi-Medium',
        }}>
        Please Login To Start Trading with {appName}
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  containerLogo: {
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#fff',
    paddingVertical: 20,
  },
  logo: {
    width: screenWidth * 0.65, // 65% of screen width
    height: 80, // Set a specific height
    resizeMode: 'contain', // Ensure the image scales properly
    marginBottom: 20,
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 10,
    color: '#000101',
  },
  subtitle: {
    fontSize: 18,
    textAlign: 'center',
    marginTop: 5,
    fontFamily: 'Satoshi-Bold',
    marginBottom: 20,
    color: '#000101',
  },
});

export default LogoSection;
