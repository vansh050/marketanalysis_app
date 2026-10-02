/**
 * useSellAuthGuide(broker) — the server's single sell-authorization guide
 * (`GET /api/sell-auth/guides/:broker`, aq_backend_github
 * utilities/sellAuthGuides.js). Cached per session. While loading, or when
 * the server cannot be reached, returns a generic built-in guide so the sheet
 * never renders empty. Copy changes belong on the server, not here.
 */
import {useEffect, useState} from 'react';
import axios from 'axios';
import Config from 'react-native-config';
import server from '../utils/serverConfig';
import {generateToken} from '../utils/SecurityTokenManager';
import {getTenantSubdomain} from '../utils/variantHelper';

const cache = new Map();

export const FALLBACK_RULE = {
  title: "Approve today's sell with your CDSL TPIN",
  summary:
    'CDSL needs your approval for each stock and quantity before it can be sold. ' +
    'The approval lasts until the end of today and does not sell anything.',
  ddpiTip: 'Activate DDPI with your broker once to skip this step on future sells.',
};

export const FALLBACK_CDSL_STEPS = [
  'On the CDSL page, tap Submit.',
  'Enter your CDSL TPIN, then the OTP sent to your phone. Forgot TPIN? Use the link on that page.',
  'Come back here and tap “Done — place sells”.',
];

export const fallbackGuide = broker => ({
  rule: FALLBACK_RULE,
  cdslSteps: FALLBACK_CDSL_STEPS,
  guide: {
    broker: broker || 'your broker',
    method: 'portal',
    where: `Open ${broker || 'your broker'} → Portfolio → Holdings → Authorise.`,
    openUrl: null,
    steps: [
      `Open ${broker || 'your broker'} → Portfolio → Holdings → Authorise.`,
      ...FALLBACK_CDSL_STEPS,
    ],
    ddpiUrl: null,
    note: null,
  },
  source: 'fallback',
});

export default function useSellAuthGuide(broker, configData) {
  const [data, setData] = useState(() => cache.get(broker) || fallbackGuide(broker));

  useEffect(() => {
    if (!broker) return undefined;
    if (cache.has(broker)) {
      setData(cache.get(broker));
      return undefined;
    }
    let cancelled = false;
    axios
      .get(
        `${server.server.baseUrl}api/sell-auth/guides/${encodeURIComponent(broker)}`,
        {
          timeout: 8000,
          headers: {
            'X-Advisor-Subdomain': getTenantSubdomain(configData),
            'aq-encrypted-key': generateToken(
              Config.REACT_APP_AQ_KEYS,
              Config.REACT_APP_AQ_SECRET,
            ),
          },
        },
      )
      .then(res => {
        const body = res?.data;
        if (!body?.guide?.steps?.length) return;
        const value = {...body, source: 'server'};
        cache.set(broker, value);
        if (!cancelled) setData(value);
      })
      .catch(() => {
        /* keep the built-in fallback */
      });
    return () => {
      cancelled = true;
    };
  }, [broker, configData]);

  return data;
}
