/**
 * useHomePlanSummary — derives top MP + bespoke plan rows for the alphanomy
 * HomeScreen's "Model Portfolios" hero card and "Top Bespoke Plans" white
 * card. Mirrors `getAllStrategy` / `getAllBespoke` in
 * `src/screens/Drawer/ModelPortfolioScreen.js` (same endpoints, same
 * advisorTag/userEmail dependencies, same auth headers) but stops at the
 * top plan from each list — no need to render the full catalog from Home.
 *
 * Returns:
 *   {
 *     heroPlan: <alphanomyPlanShape.shapeMpPlan return> | null,
 *     bespokePlan: <alphanomyPlanShape.shapeBespokePlan return> | null,
 *   }
 *
 * Returns null entries when:
 *   - The user isn't authenticated (no Firebase email)
 *   - The advisor config hasn't loaded yet (no advisorTag)
 *   - The catalog endpoint returned empty / errored
 *
 * Callers fall back to design-preview placeholders (the FALLBACK_HERO /
 * FALLBACK_BESPOKE constants in `designs/alphanomy/screens/HomeScreen.js`)
 * so the cards never render empty during boot.
 *
 * Fetches on mount + on `userEmail` / `advisorTag` change, and exposes a
 * `refetch()` so callers can force a fresh catalog pull (e.g. pull-to-refresh
 * on Home) — otherwise a plan deleted/unpublished on the admin dashboard
 * after this hook's initial fetch keeps showing on Home indefinitely, since
 * neither dep changes on a manual refresh (2026-07-16).
 */

import { useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import server from '../../../utils/serverConfig';
import Config from '../../../utils/safeConfig';
import { generateToken } from '../../../utils/SecurityTokenManager';
import { shapeMpPlan, shapeBespokePlan } from '../../../utils/alphanomyPlanShape';

const TIMEOUT_MS = 10000;

const fetchCatalog = async (kind, advisorTag, userEmail, headerName) => {
    if (!advisorTag || !userEmail) return [];
    try {
        const res = await axios.get(
            `${server.server.baseUrl}api/admin/plan/${advisorTag}/${kind}/${userEmail}`,
            {
                headers: {
                    'Content-Type': 'application/json',
                    'X-Advisor-Subdomain': headerName,
                    'aq-encrypted-key': generateToken(
                        Config?.REACT_APP_AQ_KEYS,
                        Config?.REACT_APP_AQ_SECRET,
                    ),
                },
                timeout: TIMEOUT_MS,
            },
        );
        const data = res?.data?.data;
        // Hide draft (unpublished) plans — matches web parity. Without this,
        // a plan that an advisor flips to draft on the dashboard keeps showing
        // in the home summary cards.
        return Array.isArray(data) ? data.filter(plan => !plan?.draft) : [];
    } catch {
        return [];
    }
};

export default function useHomePlanSummary({ userEmail, advisorTag, headerName }) {
    const [mpList, setMpList] = useState(null);
    const [bespokeList, setBespokeList] = useState(null);
    const [refreshNonce, setRefreshNonce] = useState(0);

    useEffect(() => {
        let cancelled = false;
        if (!userEmail || !advisorTag) {
            setMpList([]);
            setBespokeList([]);
            return undefined;
        }
        const run = async () => {
            const [mp, bes] = await Promise.all([
                fetchCatalog('model portfolio', advisorTag, userEmail, headerName),
                fetchCatalog('bespoke', advisorTag, userEmail, headerName),
            ]);
            if (cancelled) return;
            setMpList(mp);
            setBespokeList(bes);
        };
        run();
        return () => {
            cancelled = true;
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [userEmail, advisorTag, headerName, refreshNonce]);

    const refetch = () => setRefreshNonce(n => n + 1);

    const heroPlan = useMemo(
        () => shapeMpPlan((mpList || [])[0]),
        [mpList],
    );
    const bespokePlan = useMemo(
        () => shapeBespokePlan((bespokeList || [])[0]),
        [bespokeList],
    );

    const heroPlanRaw = (mpList || [])[0] || null;
    const bespokePlanRaw = (bespokeList || [])[0] || null;

    return { heroPlan, bespokePlan, heroPlanRaw, bespokePlanRaw, refetch };
}
