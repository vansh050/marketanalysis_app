/**
 * Broker display config — single source of truth for which brokers appear
 * in `BrokerSelectionModal` and in what order.
 *
 * To hide a broker: comment out or remove its entry.
 * To reorder: move the entry.
 * To re-enable Angel One: uncomment the entry below.
 *
 * `key` must match the key used by `GlobalUIModals/ModalManager.js` —
 * it is what `openModal(key)` dispatches to route to the per-broker modal.
 */

export const brokerDisplayConfig = [
  // {
  //   name: 'AngelOne',
  //   key: 'Angel One',
  //   logo: require('../assets/AngleLogo.png'),
  // },
  {
    name: 'Zerodha',
    key: 'Zerodha',
    logo: require('../assets/Zerodha.png'),
  },
  {
    name: 'ICICI',
    key: 'ICICI',
    logo: require('../assets/icici.png'),
  },
  {
    name: 'Upstox',
    key: 'Upstox',
    logo: require('../assets/upstox.png'),
  },
  {
    name: 'Kotak',
    key: 'Kotak',
    logo: require('../assets/kotak_securities.png'),
  },
  {
    name: 'Hdfc',
    key: 'HDFC',
    logo: require('../assets/hdfc_securities.png'),
  },
  {
    name: 'Dhan',
    key: 'Dhan',
    logo: require('../assets/dhan.png'),
  },
  {
    name: 'AliceBlue',
    key: 'AliceBlue',
    logo: require('../assets/aliceblue.png'),
  },
  {
    name: 'Fyers',
    key: 'Fyers',
    logo: require('../assets/fyers.png'),
  },
  {
    name: 'Motilal Oswal',
    key: 'Motilal',
    logo: require('../assets/Motilalicon.png'),
  },
  {
    name: 'Groww',
    key: 'Groww',
    logo: require('../assets/GrowwIcon.png'),
  },
  {
    name: 'Axis Securities',
    key: 'Axis Securities',
    logo: require('../assets/axis.png'),
  },
];

export default brokerDisplayConfig;
