/**
 * useRefreshBrokerStatus
 *
 * Fetches network-fresh `{brokerStatus, broker, funds}` for the current user
 * without relying on React closure values that lag one render cycle behind
 * a successful broker reconnect.
 *
 * Two-tier fast-path (added 2026-04-23 after Trade Now felt slow):
 *   1. If context already reports a connected broker AND has live funds with
 *      `data.availablecash`, return context values immediately — no network
 *      calls. The hot path for returning customers.
 *   2. Otherwise, fire getUser and fetchFunds in parallel (uses context
 *      userDetails for credentials — good enough for Trade Now; getUser runs
 *      alongside to catch broker-disconnect-from-another-device edge cases).
 *      Falls back to a serialized refresh if the broker changed mid-flight.
 *
 * The slow-path (serialized) is preserved for the "user just reconnected
 * Upstox" case — context broker/funds would be stale, fast-path short-circuit
 * would skip. The fast-path also skips if context funds has an error status.
 *
 * **Force-network mode** (added 2026-04-24 after Fyers silent-fail bug):
 *   Pass `{forceNetwork: true}` to skip the fast path entirely. Required at
 *   pre-trade chokepoints — context funds from a valid-earlier session is
 *   not proof the token is still valid now. Fyers / Dhan / Upstox / Zerodha
 *   all have short-lived access tokens (~daily); stale cached funds let
 *   orders pass pre-flight only to fail at the broker. With forceNetwork,
 *   we always ping fetchFunds; a real auth failure surfaces the
 *   TokenExpireBrokerModal so the user can reconnect in-place.
 *
 * Contract for callers unchanged: `freshStatus.funds ?? funds` /
 * `freshStatus.brokerStatus || brokerStatus`.
 */
import {useCallback} from 'react';
import axios from 'axios';
import Config from 'react-native-config';
import server from '../utils/serverConfig';
import {generateToken} from '../utils/SecurityTokenManager';
import {fetchFunds} from '../FunctionCall/fetchFunds';
import {useTrade} from '../screens/TradeContext';

const hasLiveFunds = f =>
  !!f &&
  f.status !== 1 &&
  f.status !== 2 &&
  f.status !== false &&
  !!f.data;

export function useRefreshBrokerStatus(userEmail) {
  const {
    funds,
    broker,
    brokerStatus,
    userDetails,
    configData,
    getUserDeatils,
    setFunds,
  } = useTrade();

  const refreshBrokerStatus = useCallback(async (opts) => {
    const forceNetwork = !!(opts && opts.forceNetwork);
    if (!userEmail) {
      return {brokerStatus, broker, funds, userDetails};
    }

    // FAST PATH: context already has a connected broker + live funds. Skip
    // both network calls — the user's state is fresh enough to trade on.
    // Bypassed when forceNetwork is true — pre-trade chokepoints need a
    // real probe of the funds endpoint because cached funds don't prove the
    // broker session is still alive (tokens for Fyers / Dhan / Upstox /
    // Zerodha can expire between page-load and trade-click).
    if (
      !forceNetwork &&
      brokerStatus === 'connected' &&
      broker &&
      hasLiveFunds(funds)
    ) {
      return {brokerStatus, broker, funds, userDetails};
    }

    try {
      // Parallel-fire getUser + fetchFunds using context creds. If getUser
      // reveals a different broker than context, we fall back to a second
      // fetchFunds with the fresh user. In the common case (broker unchanged
      // or brand-new reconnect), the first round-trip is already enough.
      const getUserPromise = axios.get(
        `${server.server.baseUrl}api/user/getUser/${userEmail}`,
        {
          headers: {
            'Content-Type': 'application/json',
            'X-Advisor-Subdomain': configData?.config?.REACT_APP_HEADER_NAME,
            'aq-encrypted-key': generateToken(
              Config.REACT_APP_AQ_KEYS,
              Config.REACT_APP_AQ_SECRET,
            ),
          },
          timeout: 8000,
        },
      );

      const ctxBroker = broker || userDetails?.user_broker;
      const fetchFundsPromise = ctxBroker
        ? fetchFunds(
            ctxBroker,
            userDetails?.clientCode,
            userDetails?.apiKey,
            userDetails?.jwtToken,
            userDetails?.secretKey,
            userDetails?.sid,
            userDetails?.serverId,
            userEmail,
          ).catch(err => {
            console.warn('[useRefreshBrokerStatus] fetchFunds (parallel) failed:', err?.message);
            return null;
          })
        : Promise.resolve(null);

      const [userResponse, fetchedFundsFirst] = await Promise.all([
        getUserPromise,
        fetchFundsPromise,
      ]);

      const freshUserDetails = userResponse.data?.User;
      if (getUserDeatils) {
        // Non-blocking: also push into context for later re-renders.
        getUserDeatils();
      }

      // If server says a different broker than we used for the parallel
      // fetchFunds, do a second serialized fetch with the right creds.
      let freshFunds = fetchedFundsFirst;
      const serverBroker = freshUserDetails?.user_broker;
      const brokerChangedMidFlight =
        serverBroker && ctxBroker && serverBroker !== ctxBroker;

      if (brokerChangedMidFlight && freshUserDetails?.user_broker) {
        try {
          const retry = await fetchFunds(
            freshUserDetails.user_broker,
            freshUserDetails.clientCode,
            freshUserDetails.apiKey,
            freshUserDetails.jwtToken,
            freshUserDetails.secretKey,
            freshUserDetails.sid,
            freshUserDetails.serverId,
            userEmail,
          );
          if (retry) freshFunds = retry;
        } catch (retryErr) {
          console.warn(
            '[useRefreshBrokerStatus] broker-changed retry fetchFunds failed:',
            retryErr?.message,
          );
        }
      }

      if (freshFunds) {
        if (setFunds) setFunds(freshFunds);
      }

      return {
        brokerStatus: freshUserDetails?.connect_broker_status ?? brokerStatus,
        broker: freshUserDetails?.user_broker ?? broker,
        userDetails: freshUserDetails ?? userDetails,
        funds: freshFunds ?? funds,
      };
    } catch (error) {
      console.error('[useRefreshBrokerStatus] error:', error?.message);
      return {brokerStatus, broker, funds, userDetails};
    }
  }, [
    userEmail,
    configData,
    brokerStatus,
    broker,
    funds,
    userDetails,
    getUserDeatils,
    setFunds,
  ]);

  return refreshBrokerStatus;
}

export default useRefreshBrokerStatus;
