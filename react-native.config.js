module.exports = {
    project: {
      ios: {},
      android: {},
    },
    dependencies: {
      // IAP is used only by the iOS payment flow. Do not package its legacy
      // Google Play Billing dependency in Android until Android IAP exists.
      'react-native-iap': {
        platforms: {
          android: null,
        },
      },
    },
    assets: ['./src/assets/fonts',
      
    ], 
  };
