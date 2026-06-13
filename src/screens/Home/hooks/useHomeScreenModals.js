/**
 * useHomeScreenModals — Phase E prep refactor (2026-05-01)
 *
 * Consolidates HomeScreen's 4 independent modal-visibility booleans behind
 * a single `{ activeModal, activeModalData }` state. Modals on this screen
 * are mutually exclusive (you don't show video and PDF simultaneously), so
 * collapsing them is safe.
 *
 * Backward-compat: each legacy boolean + setter is exposed unchanged so
 * existing HomeScreen.js call sites need no edit. New code should prefer
 * the canonical `activeModal` / `openModal(name, data)` / `closeModal()`
 * API.
 *
 * Modal names: 'ethical' (ethical-list modal), 'update' (app-update modal),
 * 'video' (video player), 'pdf' (PDF viewer).
 *
 * Why this lands as Phase E prep, not Phase E.2 directly: it shrinks
 * HomeScreen's state surface from 4 useState declarations to 1 hook call
 * BEFORE the eventual container/presentation split, so that split has a
 * clean modal API to expose in the viewModel.
 */

import { useState, useCallback } from 'react';

const MODAL_NAMES = ['ethical', 'update', 'video', 'pdf'];

export const useHomeScreenModals = () => {
    const [activeModal, setActiveModal] = useState(null);
    const [activeModalData, setActiveModalData] = useState(null);

    const openModal = useCallback((name, data = null) => {
        if (!MODAL_NAMES.includes(name)) {
            if (typeof __DEV__ !== 'undefined' && __DEV__) {
                console.warn(`[useHomeScreenModals] unknown modal name: ${name}`);
            }
            return;
        }
        setActiveModal(name);
        setActiveModalData(data);
    }, []);

    const closeModal = useCallback(() => {
        setActiveModal(null);
        setActiveModalData(null);
    }, []);

    // Boolean shim factory — true opens that modal, false closes IF
    // that's the active modal (so a stray false doesn't dismiss an unrelated one).
    const makeShim = (name) => (v) => {
        if (v) openModal(name);
        else if (activeModal === name) closeModal();
    };

    return {
        // Canonical
        activeModal,
        activeModalData,
        openModal,
        closeModal,
        // Legacy boolean shims (exact names from pre-refactor HomeScreen)
        showEthicalList: activeModal === 'ethical',
        setShowEthicalList: makeShim('ethical'),
        showUpdateModal: activeModal === 'update',
        setShowUpdateModal: makeShim('update'),
        videoModalVisible: activeModal === 'video',
        setVideoModalVisible: makeShim('video'),
        pdfModalVisible: activeModal === 'pdf',
        setPdfModalVisible: makeShim('pdf'),
    };
};

export default useHomeScreenModals;
