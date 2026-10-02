/**
 * PortfolioScreen styles — extracted from the legacy container as part of the
 * design-system migration (2026-05-05). Keeps the visual contract of the
 * default presentation 1:1 with the pre-extraction render so that the
 * design-registry split (designs/default/screens/PortfolioScreen.js receives
 * these styles, designs/alphanomy/screens/PortfolioScreen.js ships its own
 * StyleSheet) does not change pixel output for non-alphanomy variants.
 */

import { StyleSheet } from 'react-native';

import { designColor, designFont } from '../../design/literalTokens';

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: designColor('fff'),
  },
  modalContainer: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  modalContent: {
    backgroundColor: designColor('fff'),
    padding: 20,
    borderRadius: 10,
    shadowColor: designColor('000'),
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 5,
  },
  modalTitle: {
    fontSize: 16,
    fontFamily: designFont('Satoshi-Bold'),
    marginBottom: 10,
  },
  scoreContainer: {
    marginVertical: 10,
  },
  scoreText: {
    fontSize: 16,
    color: designColor('333'),
    marginVertical: 3,
  },
  totalScore: {
    fontSize: 18,
    fontWeight: 'bold',
    color: designColor('007aff'),
    marginTop: 10,
  },
  infoText: {
    fontSize: 14,
    color: designColor('666'),
    marginBottom: 10,
    fontFamily: designFont('Satoshi-Medium'),
  },
  button: {
    backgroundColor: designColor('fff'),
    paddingVertical: 10,
    borderWidth: 1,
    paddingHorizontal: 20,
    borderRadius: 20,
    marginTop: 10,
  },
  buttonText: {
    color: designColor('000'),
    fontSize: 12,
    fontFamily: designFont('Satoshi-Medium'),
  },
  closeButton: {
    marginTop: 10,
  },
  closeButtonText: {
    color: designColor('007aff'),
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
    backgroundColor: designColor('ff5733'),
  },
  tabBar: {
    backgroundColor: designColor('fff'),
  },
  tabButton: {
    paddingVertical: 12,
    paddingHorizontal: 10,
  },
  activeTabText: {
    color: designColor('000'),
    fontFamily: designFont('Satoshi-Medium'),
  },
  inactiveTabText: {
    color: designColor('fff'),
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
    borderColor: designColor('33d37c'),
  },
  symbolCard: {},
  buyAction: {
    backgroundColor: designColor('fff'),
  },
  sellAction: {
    backgroundColor: designColor('fff'),
  },
  buyActiontext: {
    color: designColor('33d37c'),
    fontFamily: designFont('Satoshi-Medium'),
    fontSize: 12,
  },
  innerTab: {
    borderRadius: 20,
    borderWidth: 2,
    marginHorizontal: 10,
    marginBottom: 5,
    borderColor: designColor('e4e4e4'),
    paddingHorizontal: 8,
    backgroundColor: designColor('fff'),
  },
  activeInnerTab: {
    paddingHorizontal: 8,
    borderRadius: 20,
    backgroundColor: designColor('e4e8ed'),
    borderWidth: 1.5,
    borderColor: designColor('7188a4'),
  },
  sellActiontext: {
    padding: 5,
    color: designColor('cf3a49'),
    fontFamily: designFont('Satoshi-Regular'),
    fontSize: 14,
    marginBottom: 1,
  },
  actionText: {
    fontSize: 20,
    padding: 0,
    fontWeight: 'bold',
    color: designColor('010001'),
  },
  holdingStatusContainer: {
    backgroundColor: designColor('e7eefe'),
    padding: 3,
    paddingHorizontal: 8,
    borderRadius: 5,
  },
  holdingStatusText: {
    color: designColor('6181c6'),
  },
  soldHoldingContainer: {
    backgroundColor: designColor('f7f7f9'),
  },
  soldHoldingText: {
    color: designColor('a6a6a8'),
  },
  StockTitle: {
    fontSize: 22,
    fontFamily: designFont('Satoshi-Bold'),
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
    backgroundColor: designColor('c84444'),
    marginTop: 10,
    elevation: 5,
  },
  flatListContainerHolding: {
    flex: 1,
  },
  flatListContainerpos: {
    flex: 1,
    backgroundColor: designColor('ffffff'),
  },
  card: {
    marginHorizontal: 20,
    padding: 20,
    borderRadius: 5,
    backgroundColor: designColor('000'),
  },
  positionamountText: {
    fontSize: 16,
    color: 'white',
    alignSelf: 'center',
    textAlign: 'center',
  },
  amountValue: {
    fontSize: 17,
    fontFamily: designFont('Satoshi-SemiBold'),
    color: 'black',
  },
  belowpositionamountValue: {
    fontSize: 20,
    fontFamily: designFont('Satoshi-Regular'),
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
    fontFamily: designFont('Satoshi-Regular'),
    marginTop: 0,
  },
  pnlText2: {
    fontSize: 16,
    color: 'white',
    fontFamily: designFont('Satoshi-Regular'),
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
    color: designColor('000000'),
    fontSize: 14,
    fontFamily: designFont('Satoshi-Medium'),
  },
  subText: {
    fontFamily: designFont('Satoshi-Medium'),
    fontSize: 14,
    marginLeft: 10,
  },
  positiveSubText: {
    color: designColor('16a085'),
  },
  negativeSubText: {
    color: designColor('e43d3d'),
  },
  zeroSubText: {
    color: designColor('000000'),
  },
  pnlValue: {
    fontSize: 18,
    fontFamily: designFont('Satoshi-Medium'),
    color: designColor('73be4a'),
    alignSelf: 'center',
    textAlignVertical: 'bottom',
    textAlign: 'center',
    marginRight: 10,
    marginTop: 2,
  },
  pnlValuepos: {
    fontSize: 18,
    fontFamily: designFont('Satoshi-Medium'),
    color: designColor('73be4a'),
    alignSelf: 'center',
    textAlignVertical: 'bottom',
    textAlign: 'center',
    marginRight: 10,
    marginTop: 2,
  },
  pnlValueneg: {
    fontSize: 18,
    fontFamily: designFont('Satoshi-Medium'),
    color: designColor('cf3a49'),
    alignSelf: 'center',
    textAlignVertical: 'bottom',
    textAlign: 'center',
    marginRight: 10,
    marginTop: 2,
  },
  pnlPercentage: {
    fontSize: 14,
    color: designColor('73be4a'),
    paddingTop: 2,
    textAlignVertical: 'center',
    fontFamily: designFont('Satoshi-Medium'),
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
    color: designColor('a0a0a0'),
  },
  stockName: {
    fontSize: 14,
    fontFamily: designFont('Satoshi-Medium'),
    color: designColor('333'),
    marginLeft: 10,
  },
  change: {
    fontSize: 1,
    color: 'green',
  },
  qtyAvg: {
    fontSize: 14,
    color: designColor('a0a0a0'),
  },
  qtyAvg2: {
    fontSize: 12,
    color: 'black',
    fontFamily: designFont('Satoshi-Medium'),
  },
  qtyAvgblue: {
    fontSize: 14,
    color: designColor('6791ea'),
    fontFamily: designFont('Satoshi-Medium'),
  },
  invested: {
    fontSize: 14,
    color: designColor('a0a0a0'),
  },
  invested1: {
    fontSize: 14,
    color: 'black',
    fontFamily: designFont('Satoshi-Medium'),
  },
  ltp: {
    fontSize: 14,
    color: designColor('a0a0a0'),
    fontFamily: designFont('Satoshi-Medium'),
  },
  ltp1: {
    fontSize: 14,
    color: 'black',
    fontFamily: designFont('Satoshi-Medium'),
  },
  changeValue: {
    fontSize: 14,
    fontFamily: designFont('Satoshi-Regular'),
    color: 'green',
  },
  poschangeValue: {
    fontSize: 14,
    color: designColor('16a085'),
    fontFamily: designFont('Satoshi-Medium'),
    justifyContent: 'flex-end',
    alignContent: 'flex-end',
    alignItems: 'flex-end',
    alignSelf: 'flex-end',
  },
  negchangeValue: {
    fontSize: 14,
    color: designColor('e6626f'),
    fontFamily: designFont('Satoshi-Medium'),
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
    backgroundColor: designColor('fff'),
    paddingTop: 16,
  },
  headerSubText: {
    fontSize: 15,
    color: 'grey',
    fontFamily: designFont('Satoshi-Regular'),
  },
  separator: {
    width: '100%',
    height: 1,
    backgroundColor: designColor('eaeaea'),
    marginVertical: 10,
  },
  pnlPercentageContainerpos: {
    backgroundColor: designColor('f0ffe8'),
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 2,
  },
  pnlPercentagepos: {
    fontSize: 14,
    color: designColor('73be4a'),
    fontFamily: designFont('Satoshi-Medium'),
  },
  pnlPercentageContainerneg: {
    backgroundColor: designColor('fdeaec'),
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 2,
  },
  pnlPercentageneg: {
    fontSize: 14,
    color: designColor('cf3a49'),
    fontFamily: designFont('Satoshi-Medium'),
  },
  tabContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    backgroundColor: designColor('fff'),
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    elevation: 1,
    borderBottomWidth: 1,
    borderBottomColor: designColor('ccc'),
  },
  activeTab: {
    borderBottomWidth: 1,
    borderBottomColor: designColor('000'),
  },
  tabText: {
    fontSize: 14,
    color: 'grey',
    fontFamily: designFont('Satoshi-Regular'),
  },
  tabTextup: {
    fontSize: 15,
    color: designColor('7f7f7f'),
    fontFamily: designFont('Satoshi-Regular'),
  },
  activeTabTextup: {
    fontSize: 15,
    color: designColor('002a5c'),
    fontFamily: designFont('Satoshi-Medium'),
  },
  listItem: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    backgroundColor: designColor('ffffff'),
    borderBottomWidth: 1,
    borderBottomColor: designColor('ebebeb'),
  },
  amountText: {
    fontSize: 16,
    color: 'white',
    fontFamily: designFont('Satoshi-Regular'),
  },
  circularProgressValue: {
    fontSize: 14,
    color: 'black',
  },
  shadowView: {
    backgroundColor: designColor('ffffff'),
    shadowColor: designColor('000'),
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
    backgroundColor: designColor('1264d4'),
  },
  toggleBtnUnselectedButton: {
    backgroundColor: designColor('f4f4f4'),
  },
  toggleBtnText: {
    fontSize: 12,
    alignContent: 'center',
    alignItems: 'center',
    alignSelf: 'center',
    fontFamily: designFont('Poppins-Medium'),
  },
  toggleBtnSelectedText: {
    color: designColor('fff'),
    fontWeight: '600',
  },
  toggleBtnUnselectedText: {
    color: designColor('232323'),
    fontWeight: '500',
  },
  staleHoldingsBanner: {
    marginHorizontal: 16,
    marginTop: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: designColor('f0c36a'),
    backgroundColor: designColor('fff8e7'),
    paddingHorizontal: 12,
    paddingVertical: 9,
  },
  staleHoldingsTitle: {
    color: designColor('8a5a00'),
    fontFamily: designFont('Satoshi-Bold'),
    fontSize: 12,
  },
  staleHoldingsText: {
    color: designColor('6b5a35'),
    fontFamily: designFont('Satoshi-Regular'),
    fontSize: 11,
    marginTop: 2,
  },
  planSelectorRow: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 10,
    gap: 10,
    backgroundColor: designColor('fff'),
  },
  planDropdown: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: designColor('f4f8fe'),
    borderRadius: 8,
    borderWidth: 1,
    borderColor: designColor('dbe7ff'),
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  planDropdownLabel: {
    fontSize: 11,
    color: designColor('8899aa'),
    fontFamily: designFont('Satoshi-Medium'),
    marginRight: 6,
  },
  planDropdownValue: {
    flex: 1,
    fontSize: 13,
    color: designColor('1f2b38'),
    fontFamily: designFont('Satoshi-Bold'),
  },
  planDropdownArrow: {
    fontSize: 10,
    color: designColor('8899aa'),
    marginLeft: 4,
  },
  brokerBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: designColor('f4f8fe'),
    borderRadius: 8,
    borderWidth: 1,
    borderColor: designColor('dbe7ff'),
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  brokerBadgeValue: {
    fontSize: 13,
    color: designColor('1f2b38'),
    fontFamily: designFont('Satoshi-Bold'),
    maxWidth: 100,
  },
  pickerOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.35)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  pickerContainer: {
    backgroundColor: designColor('fff'),
    borderRadius: 14,
    padding: 16,
    width: '80%',
    maxHeight: '60%',
  },
  pickerTitle: {
    fontSize: 16,
    fontFamily: designFont('Satoshi-Bold'),
    color: designColor('1f2b38'),
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
    backgroundColor: designColor('1264d4'),
  },
  pickerItemText: {
    fontSize: 14,
    fontFamily: designFont('Satoshi-Medium'),
    color: designColor('333'),
  },
  pickerItemTextSelected: {
    color: designColor('fff'),
  },
});

export default styles;
