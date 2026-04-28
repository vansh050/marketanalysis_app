import React from 'react';
import {Text, Linking} from 'react-native';
import Toast from 'react-native-toast-message';

/**
 * Inline URL with tap-to-open + tap-to-copy behaviour, for broker
 * connect instruction text (login portals, API dashboards, redirect
 * URLs). Drop-in replacement for the app-wide pattern:
 *
 *   <Text
 *     onPress={() => Linking.openURL(url)}
 *     style={styles.link}>
 *     {url}
 *   </Text>
 *
 * Rendered as a pure chain of `<Text>` nodes so it nests cleanly inside
 * the surrounding instruction `<Text>` paragraph (TouchableOpacity can
 * NOT be nested inside Text in RN — only Text/Image).
 *
 * Clipboard: RN 0.78 dropped core `Clipboard` and this project doesn't
 * install `@react-native-clipboard/clipboard` as an explicit dep. Same
 * pattern as MotilalConnectUI / HelpModal / KotakConsumerKeySteps —
 * reference `Clipboard` as a runtime global and fall back to a toast
 * telling the user to long-press to copy manually (`selectable` on the
 * URL text makes that work natively on iOS + Android).
 */
const LinkifiedUrl = ({url, display, style, copyLabel = ' ⧉'}) => {
  if (!url) return null;

  const handleOpen = () => {
    Linking.openURL(url).catch(() => {
      Toast.show({
        type: 'error',
        text1: 'Could not open link',
        text2: url,
        position: 'bottom',
        visibilityTime: 2000,
      });
    });
  };

  const handleCopy = () => {
    try {
      // eslint-disable-next-line no-undef
      Clipboard.setString(url);
      Toast.show({
        type: 'success',
        text1: 'Link copied',
        text2: url,
        position: 'bottom',
        visibilityTime: 1500,
      });
    } catch {
      Toast.show({
        type: 'info',
        text1: 'Long-press the link to copy manually',
        position: 'bottom',
        visibilityTime: 2500,
      });
    }
  };

  return (
    <Text>
      <Text selectable onPress={handleOpen} style={[styles.link, style]}>
        {display || url}
      </Text>
      <Text
        onPress={handleCopy}
        suppressHighlighting
        accessibilityLabel="Copy link"
        style={styles.copy}>
        {copyLabel}
      </Text>
    </Text>
  );
};

const styles = {
  link: {
    color: '#1890FF',
    textDecorationLine: 'underline',
  },
  copy: {
    color: '#1890FF',
    fontWeight: '700',
    fontSize: 16,
  },
};

export default LinkifiedUrl;
