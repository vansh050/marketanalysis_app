/**
 * ModelPFCard — container (Phase I, 2026-05-02)
 *
 * Owns: useTrade (configData), useNavigation, axios (strategy details +
 * subscription raw amount), useWebSocketCurrentPrice (not used directly
 * but imported for PortfolioPercentage), portfolioEvents listener,
 * order-status filtering (isOrderRejected, isOrderSuccess, isOrderPending).
 *
 * Resolves presentation from `composites.ModelPFCard`.
 */

import React, { useState, useEffect } from 'react';
import { useNavigation } from '@react-navigation/native';
import axios from 'axios';
import Config from 'react-native-config';
import { useComponent } from '../../design/useDesign';
import useTokens from '../../theme/useTokens';
import server from '../../utils/serverConfig';
import { generateToken } from '../../utils/SecurityTokenManager';
import PortfolioPercentage from '../../components/AdviceScreenComponents/DynamicText/PortfolioPercentage';
import { isOrderRejected, isOrderSuccess, isOrderPending } from '../../utils/orderStatusUtils';
import { useTrade } from '../TradeContext';
import portfolioEvents, { PORTFOLIO_EVENTS } from '../../utils/portfolioEvents';
import MPF_1 from '../../assets/Mpholder1.png';

const ModalPFCard = ({
  modelName,
  userEmail,
  specificPlan,
  strategy,
  repair,
  price,
  percentage,
  index = 0,
}) => {
  const { configData } = useTrade();
  const navigation = useNavigation();
  const Presentation = useComponent('composites.ModelPFCard');
  const tokens = useTokens();
  // Prefer a plan-name-based mapping (moneyman_app: MAMM/MFCC/MSRO) so the
  // same portfolio always renders the same accent regardless of load order.
  // Fall back to `mpCardColorCycle[index]` when the plan isn't in the map,
  // and to null (no accent) when the variant supplies neither.
  const colorMap = tokens?.colors?.mpCardColorMap;
  const cardColorCycle = tokens?.colors?.mpCardColorCycle;
  let cardColor = null;
  if (colorMap && typeof modelName === 'string') {
    const upperName = modelName.toUpperCase();
    for (const [key, color] of Object.entries(colorMap)) {
      if (upperName.includes(key.toUpperCase())) { cardColor = color; break; }
    }
  }
  if (!cardColor && Array.isArray(cardColorCycle) && cardColorCycle.length > 0) {
    cardColor = cardColorCycle[index % cardColorCycle.length];
  }

  const resultfinal = specificPlan
    ? strategy.find(s => s._id === specificPlan._id)
    : null;

  const handleCardClick = () => {
    navigation.navigate('AfterSubscriptionScreen', {
      fileName: modelName,
    });
  };

  const [strategyDetails, setStrategyDetails] = useState(null);

  const getStrategyDetails = () => {
    if (modelName) {
      axios
        .get(
          `${server.server.baseUrl}api/model-portfolio/portfolios/strategy/${modelName?.replaceAll(/_/g, ' ')}`,
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
      url: `${server.server.baseUrl}api/model-portfolio-db-update/subscription-raw-amount?email=${encodeURIComponent(
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
    : 0;

  const imageUri = strategyDetails?.image
    ? `${server.server.baseUrl}${strategyDetails.image}`
    : null;

  return (
    <Presentation
      viewModel={{
        modelName,
        imageUri,
        fallbackImage: MPF_1,
        repair,
        totalInvested,
        net_portfolio_updated,
        cardColor,
      }}
      actions={{
        onCardPress: handleCardClick,
      }}
      slots={{
        PortfolioPercentageSlot: (
          <PortfolioPercentage
            type={'pfcard'}
            totalInvested={totalInvested}
            net_portfolio_updated={net_portfolio_updated}
          />
        ),
      }}
    />
  );
};

export default ModalPFCard;
