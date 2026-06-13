/**
 * GttDetailsModal — container (Phase H, 2026-05-02)
 *
 * Reshapes the raw GTT data into the viewModel expected by the
 * design-system presentation resolved as `composites.GttDetailsModal`.
 *
 * Legacy prop signature preserved:
 *   { isOpen, data, onClose }
 */

import React from 'react';
import { useComponent } from '../design/useDesign';

const GttDetailsModal = ({ isOpen, data, onClose }) => {
    const Presentation = useComponent('composites.GttDetailsModal');

    if (!data) return null;

    const transaction = data?.transactionType || data?.Type;
    const isBuy = transaction?.toLowerCase() === 'buy';

    const viewModel = {
        visible: isOpen,
        tradingSymbol: data?.tradingSymbol || data?.Symbol || '-',
        transaction,
        isBuy,
        exchange: data?.exchange || data?.Exchange,
        segment: data?.segment || data?.Segment,
        orderType: data?.orderType || data?.OrderType,
        quantity: data?.quantity || data?.Quantity,
        entryLeg: data?.entryLeg,
        leg1: data?.leg1,
        leg2: data?.leg2,
    };

    const actions = { onClose };

    return <Presentation viewModel={viewModel} actions={actions} />;
};

export default GttDetailsModal;
