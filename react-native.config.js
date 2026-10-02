module.exports = {
    project: {
      ios: {},
      android: {},
    },
    dependencies: {
      // Apple IAP is invoked only from the iOS payment flow.  Leaving this
      // native module linked on Android embeds its legacy Play Billing 7
      // dependency even though the Android app never uses it, which causes
      // Google Play's Billing Library compliance notice.  Keep the iOS pod
      // linked and exclude only Android until/if Android IAP is introduced.
      'react-native-iap': {
        platforms: {
          android: null,
        },
      },
    },
    assets: ['./src/assets/fonts',
      
    ], 
  };
