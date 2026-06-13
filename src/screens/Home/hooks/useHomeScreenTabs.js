/**
 * useHomeScreenTabs — Phase E prep refactor (2026-05-01)
 *
 * Consolidates HomeScreen's tab + 7-way "see all overlay" state behind a
 * single hook. The 7 overlay booleans (seeAllBespoke, seeAllBespokeplan,
 * seeAllMP, seeAllMPplan, seeAllBlogs, seeAllVideos, seeAllPDFs) are now
 * derived from a single `overlay: string | null` state — only one overlay
 * can be active at a time, which matches how the screen actually behaved
 * before this refactor (the conditional render checks `seeAllX || seeAllY ||
 * ...` and short-circuits).
 *
 * Backward-compat: each legacy boolean + setter is exposed unchanged so
 * existing HomeScreen.js call sites need no edit. New code should prefer
 * the canonical `overlay` / `setOverlay(name | null)` API; setOverlay
 * accepts one of: 'bespoke' / 'bespokePlan' / 'mp' / 'mpPlan' / 'blogs' /
 * 'videos' / 'pdfs' / null.
 *
 * Why this lands as Phase E prep, not Phase E.2 directly: it shrinks
 * HomeScreen's state surface from 8 useState declarations to 1 hook call
 * BEFORE the eventual container/presentation split, so that split has a
 * clean overlay API to expose in the viewModel.
 */

import { useState, useCallback } from 'react';

const OVERLAY_NAMES = ['bespoke', 'bespokePlan', 'mp', 'mpPlan', 'blogs', 'videos', 'pdfs'];

export const useHomeScreenTabs = () => {
    const [selectedTab, setSelectedTab] = useState('All');
    const [overlay, setOverlayState] = useState(null);

    const setOverlay = useCallback((name) => {
        if (name === null || OVERLAY_NAMES.includes(name)) {
            setOverlayState(name);
        } else if (typeof __DEV__ !== 'undefined' && __DEV__) {
            console.warn(`[useHomeScreenTabs] unknown overlay name: ${name}`);
        }
    }, []);

    // Boolean shim factory — true sets to that overlay, false closes IF
    // that's the active overlay (so a stray false doesn't dismiss an unrelated one).
    const makeShim = (name) => (v) => {
        if (v) setOverlay(name);
        else if (overlay === name) setOverlay(null);
    };

    return {
        // Canonical
        selectedTab,
        setSelectedTab,
        overlay,
        setOverlay,
        // Legacy boolean shims (exact names from pre-refactor HomeScreen)
        seeAllBespoke: overlay === 'bespoke',
        setSeeAllBespoke: makeShim('bespoke'),
        seeAllBespokeplan: overlay === 'bespokePlan',
        setSeeAllBespokeplan: makeShim('bespokePlan'),
        seeAllMP: overlay === 'mp',
        setSeeAllMP: makeShim('mp'),
        seeAllMPplan: overlay === 'mpPlan',
        setSeeAllMPplan: makeShim('mpPlan'),
        seeAllBlogs: overlay === 'blogs',
        setSeeAllBlogs: makeShim('blogs'),
        seeAllVideos: overlay === 'videos',
        setSeeAllVideos: makeShim('videos'),
        seeAllPDFs: overlay === 'pdfs',
        setSeeAllPDFs: makeShim('pdfs'),
    };
};

export default useHomeScreenTabs;
