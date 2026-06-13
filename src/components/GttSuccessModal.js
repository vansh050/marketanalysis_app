/**
 * GttSuccessModal — container (Phase H, 2026-05-02)
 *
 * Owns the response-parsing state (useEffect sync from
 * orderPlacementResponse) and derives error/GTT status flags.
 * Delegates rendering to the design-system presentation
 * resolved as `composites.GttSuccessModal`.
 *
 * Legacy prop signature preserved:
 *   { orderPlacementResponse, gttOpenSuccessModal, setGttOpenSucessModal }
 */

import React, { useState, useEffect } from 'react';
import moment from 'moment';
import { useComponent } from '../design/useDesign';

const GttSuccessModal = ({
    orderPlacementResponse,
    gttOpenSuccessModal,
    setGttOpenSucessModal,
}) => {
    const Presentation = useComponent('composites.GttSuccessModal');
    const [orderResponse, setOrderResponse] = useState(orderPlacementResponse);

    useEffect(() => {
        setOrderResponse(orderPlacementResponse);
    }, [orderPlacementResponse]);

    const gttData = orderResponse?.data || orderResponse;
    const isGTTOrder = gttData && (gttData.type === 'two-leg' || gttData.legs);

    const isError =
        orderResponse?.status === 1 ||
        gttData?.status === 1 ||
        gttData?.orderStatus === 'REJECTED';
    const errorMessage =
        orderResponse?.message || gttData?.message || 'An error occurred';

    const handleClose = () => {
        setGttOpenSucessModal(false);
    };

    // Derive status display string
    let statusDisplay;
    if (gttData?.status !== undefined) {
        statusDisplay =
            typeof gttData.status === 'number'
                ? gttData.status === 0
                    ? 'Active'
                    : 'Failed'
                : gttData.status;
    }

    const viewModel = {
        visible: gttOpenSuccessModal,
        isError,
        isGTTOrder,
        title: isError
            ? isGTTOrder
                ? 'GTT Order Rejected'
                : 'Order Failed'
            : isGTTOrder
                ? 'GTT Order Placed Successfully'
                : 'All Orders Placed Successfully',
        subtitle: isError
            ? errorMessage
            : isGTTOrder
                ? 'Your GTT order is now active and will trigger when market conditions are met.'
                : 'Please review the order details below.',
        symbol: gttData?.symbol || gttData?.condition?.tradingsymbol,
        currentPrice: gttData?.condition?.last_price,
        triggerValues:
            gttData?.condition?.trigger_values || gttData?.triggerValues,
        gttId: gttData?.id,
        status: statusDisplay,
        placedDate: moment().format('Do MMM YYYY'),
    };

    const actions = { onClose: handleClose };

    return <Presentation viewModel={viewModel} actions={actions} />;
};

export default GttSuccessModal;
