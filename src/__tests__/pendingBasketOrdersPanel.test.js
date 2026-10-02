import React from 'react';
import TestRenderer, {act} from 'react-test-renderer';
import PendingBasketOrdersPanel from '../UIComponents/StockAdvicesUI/PendingBasketOrdersPanel';
import {
  basketOrderIdentity,
  getBasketOrderAggregateStatus,
  isBasketCustomerVisibleStatus,
  isBasketInFlightStatus,
  shouldShowInOrderHistory,
} from '../utils/basketOrderState';

describe('pending basket order behavior', () => {
  test.each([
    'requested', 'ordered', 'AMO', 'after market',
    'pending_confirmation', 'validation pending', 'manually_placed',
  ])('keeps %s visible and broker-blocked', status => {
    expect(isBasketCustomerVisibleStatus(status)).toBe(true);
    expect(isBasketInFlightStatus(status)).toBe(true);
  });

  test('prefers recorded broker and requires complete immutable identity', () => {
    expect(basketOrderIdentity({
      basketId: 'basket-1', tradeId: 'leg-1', orderId: 'order-1',
      user_broker: 'Dhan',
    }, 'fallback-basket', 'Zerodha')).toEqual({
      basketId: 'basket-1', tradeId: 'leg-1', orderId: 'order-1',
      broker: 'Dhan', canCancel: true,
    });
    expect(basketOrderIdentity({orderId: 'order-1'}, 'basket-1', 'Zerodha').canCancel).toBe(false);
  });

  test('distinguishes unattempted recommendations from failed basket orders', () => {
    const recommendationOnly = {
      trade_place_status: 'recommend',
      basket_advice: [
        {trade_place_status: 'recommend'},
        {trade_place_status: 'recommend'},
      ],
    };
    const rejected = {
      trade_place_status: 'recommend',
      basket_advice: [
        {trade_place_status: 'REJECTED'},
        {trade_place_status: 'failed'},
      ],
    };
    expect(getBasketOrderAggregateStatus(recommendationOnly)).toBe('recommendation');
    expect(getBasketOrderAggregateStatus(rejected)).toBe('rejected');
    expect(shouldShowInOrderHistory(recommendationOnly)).toBe(false);
    expect(shouldShowInOrderHistory(rejected)).toBe(true);
    expect(getBasketOrderAggregateStatus({
      basket_advice: [
        {trade_place_status: 'complete'},
        {trade_place_status: 'pending'},
      ],
    })).toBe('pending');
  });

  test('renders cancellation and blocks rows missing trade identity', () => {
    const onCancel = jest.fn();
    let renderer;
    act(() => {
      renderer = TestRenderer.create(
        <PendingBasketOrdersPanel
          basketId="basket-1"
          broker="Zerodha"
          trades={[
            {Symbol: 'VALID', tradeId: 'leg-1', orderId: 'order-1', user_broker: 'Dhan', trade_place_status: 'ordered'},
            {Symbol: 'NO-TRADE-ID', orderId: 'order-2', trade_place_status: 'pending'},
          ]}
          onCancel={onCancel}
        />,
      );
    });
    const valid = renderer.root.findByProps({testID: 'cancel-pending-order-leg-1'});
    const invalid = renderer.root.findByProps({testID: 'cancel-pending-order-unavailable'});
    expect(valid.props.disabled).toBe(false);
    expect(invalid.props.disabled).toBe(true);
    act(() => valid.props.onPress());
    expect(onCancel).toHaveBeenCalledWith(
      expect.objectContaining({Symbol: 'VALID'}),
      expect.objectContaining({broker: 'Dhan', canCancel: true}),
    );
  });
});
