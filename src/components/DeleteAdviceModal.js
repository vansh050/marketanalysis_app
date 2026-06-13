/**
 * DeleteAdviceModal — container (Phase H, 2026-05-02)
 *
 * Owns the ignore/delete logic and delegates rendering to the
 * design-system presentation resolved as `composites.DeleteAdviceModal`.
 *
 * Legacy prop signature preserved for callers:
 *   { isVisible, onClose, onConfirm, handleIgnore, stockIgnoreId, stockname }
 */

import React from 'react';
import { useComponent } from '../design/useDesign';

const DeleteAdviceModal = ({
    isVisible,
    onClose,
    onConfirm,
    handleIgnore,
    stockIgnoreId,
    stockname,
}) => {
    const Presentation = useComponent('composites.DeleteAdviceModal');

    const viewModel = {
        visible: isVisible,
        stockName: stockname,
    };

    const actions = {
        onConfirm,
        onClose,
    };

    return <Presentation viewModel={viewModel} actions={actions} />;
};

export default DeleteAdviceModal;
