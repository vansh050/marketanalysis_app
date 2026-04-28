import React, {useState, useEffect} from 'react';
import {View, Text, Image, TouchableOpacity, StyleSheet} from 'react-native';
import {useNavigation} from '@react-navigation/native';
import formatCurrency from '../../utils/formatCurrency';
import MPF_1 from '../../assets/Mpholder1.png'; // Adjust the path according to your file structure
import {ChevronRightIcon, ChevronUp} from 'lucide-react-native'; // Assuming you have the icon component available
import Icon1 from 'react-native-vector-icons/AntDesign';
import server from '../../utils/serverConfig';
import axios from 'axios';
import Config from 'react-native-config';
import {generateToken} from '../../utils/SecurityTokenManager';
import useWebSocketCurrentPrice from '../../FunctionCall/useWebSocketCurrentPrice';
import PortfolioPercentage from '../../components/AdviceScreenComponents/DynamicText/PortfolioPercentage';
import {isOrderRejected, isOrderSuccess, isOrderPending} from '../../utils/orderStatusUtils';
import {useTrade} from '../TradeContext';
import portfolioEvents, {PORTFOLIO_EVENTS} from '../../utils/portfolioEvents';
const ModalPFCard = ({
  modelName,
  userEmail,
  specificPlan,
  strategy,
  repair,
  price,
  percentage,
}) => {
  const {configData} = useTrade();
  // console.log('model Name:',modelName);
  const resultfinal = specificPlan
    ? strategy.find(s => s._id === specificPlan._id)
    : null;

  const navigation = useNavigation();
  const formatNumber = num => {
    if (num >= 100000) {
      return (num / 100000).toFixed(2).replace(/\.00$/, '') + 'L';
    } else if (num >= 1000) {
      return (num / 1000).toFixed(2).replace(/\.00$/, '') + 'K';
    }
    return {num}.toString();
  };

  const handleCardClick = () => {
    //console.log('IRIOKKKKKKKKK>:',modelName,specificPlan);
    navigation.navigate('AfterSubscriptionScreen', {
      fileName: modelName,
    });
  };

  const [strategyDetails, setStrategyDetails] = useState(null);

  const getStrategyDetails = () => {
    if (modelName) {
      axios
        .get(
          `${
            server.server.baseUrl
          }api/model-portfolio/portfolios/strategy/${modelName?.replaceAll(
            /_/g,
            ' ',
          )}`,
          {
            headers: {
              'Content-Type': 'application/json',
              'X-Advisor-Subdomain': configData?.config?.REACT_APP_HEADER_NAME,
              'aq-encrypted-key': generateToken(
                Config.REACT_APP_AQ_KEYS,
                Config.REACT_APP_AQ_SECRET,
              ),
            },
          },
        )
        .then(res => {
          const portfolioData = res.data[0].originalData;
          setStrategyDetails(portfolioData);
        })
        .catch(err => console.log(err));
    }
  };
  useEffect(() => {
    getStrategyDetails();
  }, [modelName]);

  const [subscriptionAmount, setSubscrptionAmount] = useState();
  const getSubscriptionData = () => {
    let config = {
      method: 'get',
      url: `${
        server.server.baseUrl
      }api/model-portfolio-db-update/subscription-raw-amount?email=${encodeURIComponent(
        userEmail,
      )}&modelName=${encodeURIComponent(strategyDetails?.model_name)}&user_broker=${encodeURIComponent("")}`,

      headers: {
        'Content-Type': 'application/json',
        'X-Advisor-Subdomain': configData?.config?.REACT_APP_HEADER_NAME,
        'aq-encrypted-key': generateToken(
          Config.REACT_APP_AQ_KEYS,
          Config.REACT_APP_AQ_SECRET,
        ),
      },
    };

    axios
      .request(config)
      .then(response => {
        setSubscrptionAmount(response.data.data);
      })
      .catch(error => {
        console.log(error);
      });
  };

  useEffect(() => {
    if (userEmail !== undefined && strategyDetails !== null) {
      getSubscriptionData();
    }
  }, [strategyDetails, userEmail]);

  // Re-fetch holdings on HOLDINGS_REFRESH event (after execution)
  useEffect(() => {
    const unsub = portfolioEvents.on(PORTFOLIO_EVENTS.HOLDINGS_REFRESH, () => {
      if (userEmail && strategyDetails) {
        getSubscriptionData();
      }
    });
    return unsub;
  }, [userEmail, strategyDetails]);

  const net_portfolio_updated = [...(subscriptionAmount?.user_net_pf_model || [])].sort(
    (a, b) => new Date(b.execDate) - new Date(a.execDate),
  )[0];

  // Filter out rejected/failed/cancelled orders from calculations.
  // Orders with success/pending status (OPEN, TRANSIT, TRADED, etc.) are kept even if
  // rebalance_status is stale, since the order was actually placed at the broker.
  const validOrderResults = net_portfolio_updated?.order_results?.filter((order) => {
    if (isOrderSuccess(order.orderStatus) || isOrderPending(order.orderStatus)) {
      return Number(order.quantity || 0) > 0;
    }
    return !isOrderRejected(order.orderStatus) &&
      (order.orderStatus || '').toLowerCase() !== 'unplaced' &&
      Number(order.quantity || 0) > 0;
  });

  const totalInvested = validOrderResults
    ? validOrderResults.reduce((total, stock) => {
        return (
          total +
          (parseFloat(stock?.averagePrice) || 0) * (stock?.quantity || 0)
        );
      }, 0)
    : 0; //            ₹{formatNumber(parseFloat(totalInvested.toFixed(2)))}

  // console.log("specifi here---1",strategyDetails);
  return (
    <View style={styles.cardContainer}>
      <View style={styles.mobileView} onTouchEnd={handleCardClick}>
        <View style={styles.mobileInfoContainer}>
          <Image
            source={
              strategyDetails?.image
                ? {uri: `${server.server.baseUrl}${strategyDetails.image}`}
                : MPF_1
            }
            style={styles.mobileImage}
          />
          <View style={[styles.mobileTextContainer, {flex: 1}]}>
            <Text style={styles.mobileModelName} numberOfLines={2}>{modelName}</Text>
            {repair && (
              <View style={styles.repairBadge}>
                <Text style={styles.repairText}>Repair</Text>
                <ChevronRightIcon style={styles.icon} />
              </View>
            )}
          </View>
        </View>
        <View
          style={{
            alignItems: 'flex-end',
            justifyContent: 'center',
            minWidth: 90,
          }}>
          <Text style={styles.mobileValueText}>
            ₹{formatCurrency(totalInvested.toFixed(2))}/-
          </Text>
          <PortfolioPercentage
            type={'pfcard'}
            totalInvested={totalInvested}
            net_portfolio_updated={net_portfolio_updated}
          />
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  cardContainer: {
    backgroundColor: '#fff',
    width: '100%',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 3,
    },
    shadowOpacity: 0.06,
    shadowRadius: 20,
    paddingVertical: 5,
    paddingHorizontal: 15,
  },
  cardContent: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 5,
  },
  change: {
    fontSize: 12,
    color: '#fff',
    textAlign: 'center',
    fontFamily: 'Satoshi-Regular',
  },
  infoContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 2,
  },
  image: {
    width: 48,
    height: 40,
    marginRight: 10,
  },
  textContainer: {
    flexDirection: 'column',
  },
  modelName: {
    color: '#FFFFFF',
    fontSize: 14,
    fontFamily: 'Poppins-Medium',
  },
  repairBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#DE8846',
    borderRadius: 3,
    padding: 4,
    alignSelf: 'flex-start', // Ensure the badge takes the width of its content
  },

  repairText: {
    color: '#FFFFFF',
    fontSize: 10,
  },
  icon: {
    color: '#FFFFFF',
    width: 12,
    height: 12,
  },
  valueContainer: {
    flex: 1,
    alignItems: 'center',
  },
  valueText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '500',
  },
  percentageText: {
    color: '#7CFA8B',
    fontSize: 14,
    fontWeight: '600',
  },
  buttonContainer: {
    alignItems: 'center',
  },
  viewButton: {
    borderColor: 'rgba(255, 255, 255, 0.4)',
    borderWidth: 1,
    borderRadius: 4,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '500',
  },
  mobileView: {
    flexDirection: 'row',
    paddingHorizontal: 5,
    borderBottomWidth: 1,
    paddingBottom: 5,
    borderBottomColor: '#CCCCCC',
  },
  mobileInfoContainer: {
    flexDirection: 'row',
    alignContent: 'flex-start',
    alignItems: 'flex-start',

    flex: 1,
  },
  mobileImage: {
    width: 40,
    height: 38,
    marginRight: 5,
  },
  mobileTextContainer: {
    flex: 1, // Take up remaining space
    justifyContent: 'flex-start', // Align content to the top
    paddingLeft: 10,
  },
  mobileModelName: {
    color: '#000',
    fontSize: 13,
    fontFamily: 'Poppins-SemiBold',
  },
  mobileValueContainer: {
    alignContent: 'center',
    alignItems: 'flex-end',
    alignSelf: 'center',
    justifyContent: 'center',
  },
  mobileValueText: {
    color: '#000',
    fontSize: 13,
    fontFamily: 'Poppins-SemiBold',
  },
  mobilePercentageText: {
    color: '#16A085',
    fontSize: 13,
    fontFamily: 'Poppins-Regular',
  },
});

export default ModalPFCard;
