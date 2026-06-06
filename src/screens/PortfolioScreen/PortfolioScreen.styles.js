/**
 * PortfolioScreen styles — extracted from the legacy container as part of the
 * design-system migration (2026-05-05). Keeps the visual contract of the
 * default presentation 1:1 with the pre-extraction render so that the
 * design-registry split (designs/default/screens/PortfolioScreen.js receives
 * these styles, designs/alphanomy/screens/PortfolioScreen.js ships its own
 * StyleSheet) does not change pixel output for non-alphanomy variants.
 */

import { StyleSheet } from 'react-native';

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  modalContainer: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  modalContent: {
    backgroundColor: '#fff',
    padding: 20,
    borderRadius: 10,
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 5,
  },
  modalTitle: {
    fontSize: 16,
    fontFamily: 'Satoshi-Bold',
    marginBottom: 10,
  },
  scoreContainer: {
    marginVertical: 10,
  },
  scoreText: {
    fontSize: 16,
    color: '#333',
    marginVertical: 3,
  },
  totalScore: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#007AFF',
    marginTop: 10,
  },
  infoText: {
    fontSize: 14,
    color: '#666',
    marginBottom: 10,
    fontFamily: 'Satoshi-Medium',
  },
  button: {
    backgroundColor: '#fff',
    paddingVertical: 10,
    borderWidth: 1,
    paddingHorizontal: 20,
    borderRadius: 20,
    marginTop: 10,
  },
  buttonText: {
    color: '#000',
    fontSize: 12,
    fontFamily: 'Satoshi-Medium',
  },
  closeButton: {
    marginTop: 10,
  },
  closeButtonText: {
    color: '#007AFF',
    fontSize: 16,
    fontWeight: 'bold',
  },
  errorText: {
    color: 'red',
    fontSize: 14,
    marginBottom: 10,
  },
  containerfi: {
    flex: 1,
    backgroundColor: 'white',
  },
  list: {
    flexGrow: 1,
    backgroundColor: 'white',
  },
  container1: {
    flex: 1,
  },
  tabIndicator: {
    backgroundColor: '#FF5733',
  },
  tabBar: {
    backgroundColor: '#FFF',
  },
  tabButton: {
    paddingVertical: 12,
    paddingHorizontal: 10,
  },
  activeTabText: {
    color: '#000',
    fontFamily: 'Satoshi-Medium',
  },
  inactiveTabText: {
    color: '#fff',
  },
  actionContainer: {
    alignSelf: 'flex-end',
  },
  action: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 1,
    paddingHorizontal: 10,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#33D37C',
  },
  symbolCard: {},
  buyAction: {
    backgroundColor: '#fff',
  },
  sellAction: {
    backgroundColor: '#Fff',
  },
  buyActiontext: {
    color: '#33D37C',
    fontFamily: 'Satoshi-Medium',
    fontSize: 12,
  },
  innerTab: {
    borderRadius: 20,
    borderWidth: 2,
    marginHorizontal: 10,
    marginBottom: 5,
    borderColor: '#E4E4E4',
    paddingHorizontal: 8,
    backgroundColor: '#fff',
  },
  activeInnerTab: {
    paddingHorizontal: 8,
    borderRadius: 20,
    backgroundColor: '#E4E8ED',
    borderWidth: 1.5,
    borderColor: '#7188A4',
  },
  sellActiontext: {
    padding: 5,
    color: '#cf3a49',
    fontFamily: 'Satoshi-Regular',
    fontSize: 14,
    marginBottom: 1,
  },
  actionText: {
    fontSize: 20,
    padding: 0,
    fontWeight: 'bold',
    color: '#010001',
  },
  holdingStatusContainer: {
    backgroundColor: '#E7EEFE',
    padding: 3,
    paddingHorizontal: 8,
    borderRadius: 5,
  },
  holdingStatusText: {
    color: '#6181C6',
  },
  soldHoldingContainer: {
    backgroundColor: '#F7F7F9',
  },
  soldHoldingText: {
    color: '#A6A6A8',
  },
  StockTitle: {
    fontSize: 22,
    fontFamily: 'Satoshi-Bold',
    color: 'black',
    paddingHorizontal: 15,
  },
  badgeContainer: {
    backgroundColor: 'red',
    borderRadius: 15,
    width: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 5,
  },
  badgeText: {
    color: 'white',
    fontSize: 12,
    fontWeight: 'bold',
  },
  stickyCard: {
    padding: 18,
    borderRadius: 20,
    marginHorizontal: 10,
    backgroundColor: '#C84444',
    marginTop: 10,
    elevation: 5,
  },
  flatListContainerHolding: {
    flex: 1,
  },
  flatListContainerpos: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  card: {
    marginHorizontal: 20,
    padding: 20,
    borderRadius: 5,
    backgroundColor: '#000',
  },
  positionamountText: {
    fontSize: 16,
    color: 'white',
    alignSelf: 'center',
    textAlign: 'center',
  },
  amountValue: {
    fontSize: 17,
    fontFamily: 'Satoshi-SemiBold',
    color: 'black',
  },
  belowpositionamountValue: {
    fontSize: 20,
    fontFamily: 'Satoshi-Regular',
    color: 'red',
    alignSelf: 'center',
  },
  pnlContainer: {
    marginTop: 10,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  pnlText: {
    fontSize: 16,
    color: 'white',
    fontFamily: 'Satoshi-Regular',
    marginTop: 0,
  },
  pnlText2: {
    fontSize: 16,
    color: 'white',
    fontFamily: 'Satoshi-Regular',
  },
  pnlBorder: {
    paddingHorizontal: 15,
    alignContent: 'center',
    alignItems: 'center',
    alignSelf: 'center',
    borderColor: 'white',
    borderWidth: 1.5,
    marginRight: 10,
    borderRadius: 20,
  },
  netReturnsText: {
    color: '#000000',
    fontSize: 14,
    fontFamily: 'Satoshi-Medium',
  },
  subText: {
    fontFamily: 'Satoshi-Medium',
    fontSize: 14,
    marginLeft: 10,
  },
  positiveSubText: {
    color: '#16A085',
  },
  negativeSubText: {
    color: '#E43D3D',
  },
  zeroSubText: {
    color: '#000000',
  },
  pnlValue: {
    fontSize: 18,
    fontFamily: 'Satoshi-Medium',
    color: '#73BE4A',
    alignSelf: 'center',
    textAlignVertical: 'bottom',
    textAlign: 'center',
    marginRight: 10,
    marginTop: 2,
  },
  pnlValuepos: {
    fontSize: 18,
    fontFamily: 'Satoshi-Medium',
    color: '#73BE4A',
    alignSelf: 'center',
    textAlignVertical: 'bottom',
    textAlign: 'center',
    marginRight: 10,
    marginTop: 2,
  },
  pnlValueneg: {
    fontSize: 18,
    fontFamily: 'Satoshi-Medium',
    color: '#cf3a49',
    alignSelf: 'center',
    textAlignVertical: 'bottom',
    textAlign: 'center',
    marginRight: 10,
    marginTop: 2,
  },
  pnlPercentage: {
    fontSize: 14,
    color: '#73BE4A',
    paddingTop: 2,
    textAlignVertical: 'center',
    fontFamily: 'Satoshi-Medium',
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    color: 'white',
  },
  rowModel: {
    flexDirection: 'row',
    justifyContent: 'flex-start',
    alignItems: 'center',
    color: 'white',
  },
  row1: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginLeft: 10,
  },
  index: {
    fontSize: 16,
    color: '#A0A0A0',
  },
  stockName: {
    fontSize: 14,
    fontFamily: 'Satoshi-Medium',
    color: '#333',
    marginLeft: 10,
  },
  change: {
    fontSize: 1,
    color: 'green',
  },
  qtyAvg: {
    fontSize: 14,
    color: '#A0A0A0',
  },
  qtyAvg2: {
    fontSize: 12,
    color: 'black',
    fontFamily: 'Satoshi-Medium',
  },
  qtyAvgblue: {
    fontSize: 14,
    color: '#6791EA',
    fontFamily: 'Satoshi-Medium',
  },
  invested: {
    fontSize: 14,
    color: '#A0A0A0',
  },
  invested1: {
    fontSize: 14,
    color: 'black',
    fontFamily: 'Satoshi-Medium',
  },
  ltp: {
    fontSize: 14,
    color: '#A0A0A0',
    fontFamily: 'Satoshi-Medium',
  },
  ltp1: {
    fontSize: 14,
    color: 'black',
    fontFamily: 'Satoshi-Medium',
  },
  changeValue: {
    fontSize: 14,
    fontFamily: 'Satoshi-Regular',
    color: 'green',
  },
  poschangeValue: {
    fontSize: 14,
    color: '#16A085',
    fontFamily: 'Satoshi-Medium',
    justifyContent: 'flex-end',
    alignContent: 'flex-end',
    alignItems: 'flex-end',
    alignSelf: 'flex-end',
  },
  negchangeValue: {
    fontSize: 14,
    color: '#E6626F',
    fontFamily: 'Satoshi-Medium',
    justifyContent: 'flex-end',
    alignContent: 'flex-end',
    alignItems: 'flex-end',
    alignSelf: 'flex-end',
  },
  status: {
    fontSize: 14,
    fontWeight: 'bold',
  },
  holding: {
    color: 'green',
  },
  soldHolding: {
    color: 'red',
  },
  headerContainer: {
    backgroundColor: '#fff',
    paddingTop: 16,
  },
  headerSubText: {
    fontSize: 15,
    color: 'grey',
    fontFamily: 'Satoshi-Regular',
  },
  separator: {
    width: '100%',
    height: 1,
    backgroundColor: '#EAEAEA',
    marginVertical: 10,
  },
  pnlPercentageContainerpos: {
    backgroundColor: '#F0FFE8',
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 2,
  },
  pnlPercentagepos: {
    fontSize: 14,
    color: '#73BE4A',
    fontFamily: 'Satoshi-Medium',
  },
  pnlPercentageContainerneg: {
    backgroundColor: '#FDEAEC',
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 2,
  },
  pnlPercentageneg: {
    fontSize: 14,
    color: '#cf3a49',
    fontFamily: 'Satoshi-Medium',
  },
  tabContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    elevation: 1,
    borderBottomWidth: 1,
    borderBottomColor: '#ccc',
  },
  activeTab: {
    borderBottomWidth: 1,
    borderBottomColor: '#000',
  },
  tabText: {
    fontSize: 14,
    color: 'grey',
    fontFamily: 'Satoshi-Regular',
  },
  tabTextup: {
    fontSize: 15,
    color: '#7F7F7F',
    fontFamily: 'Satoshi-Regular',
  },
  activeTabTextup: {
    fontSize: 15,
    color: '#002A5C',
    fontFamily: 'Satoshi-Medium',
  },
  listItem: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#EBEBEB',
  },
  amountText: {
    fontSize: 16,
    color: 'white',
    fontFamily: 'Satoshi-Regular',
  },
  circularProgressValue: {
    fontSize: 14,
    color: 'black',
  },
  shadowView: {
    backgroundColor: '#ffffff',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  toggleBtnContainer: {
    flexDirection: 'row',
    gap: 16,
    margin: 20,
    justifyContent: 'center',
  },
  toggleBtnButton: {
    flex: 1,
    height: 35,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  toggleBtnSelectedButton: {
    backgroundColor: '#1264D4',
  },
  toggleBtnUnselectedButton: {
    backgroundColor: '#F4F4F4',
  },
  toggleBtnText: {
    fontSize: 12,
    alignContent: 'center',
    alignItems: 'center',
    alignSelf: 'center',
    fontFamily: 'Poppins-Medium',
  },
  toggleBtnSelectedText: {
    color: '#fff',
    fontWeight: '600',
  },
  toggleBtnUnselectedText: {
    color: '#232323',
    fontWeight: '500',
  },
  planSelectorRow: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 10,
    gap: 10,
    backgroundColor: '#fff',
  },
  planDropdown: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F4F8FE',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#DBE7FF',
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  planDropdownLabel: {
    fontSize: 11,
    color: '#8899AA',
    fontFamily: 'Satoshi-Medium',
    marginRight: 6,
  },
  planDropdownValue: {
    flex: 1,
    fontSize: 13,
    color: '#1F2B38',
    fontFamily: 'Satoshi-Bold',
  },
  planDropdownArrow: {
    fontSize: 10,
    color: '#8899AA',
    marginLeft: 4,
  },
  brokerBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F4F8FE',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#DBE7FF',
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  brokerBadgeValue: {
    fontSize: 13,
    color: '#1F2B38',
    fontFamily: 'Satoshi-Bold',
    maxWidth: 100,
  },
  pickerOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.35)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  pickerContainer: {
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 16,
    width: '80%',
    maxHeight: '60%',
  },
  pickerTitle: {
    fontSize: 16,
    fontFamily: 'Satoshi-Bold',
    color: '#1F2B38',
    marginBottom: 12,
    textAlign: 'center',
  },
  pickerItem: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    marginBottom: 4,
  },
  pickerItemSelected: {
    backgroundColor: '#1264D4',
  },
  pickerItemText: {
    fontSize: 14,
    fontFamily: 'Satoshi-Medium',
    color: '#333',
  },
  pickerItemTextSelected: {
    color: '#fff',
  },
});

export default styles;
