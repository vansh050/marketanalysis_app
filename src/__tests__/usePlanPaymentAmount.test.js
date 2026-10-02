import React from 'react';
import {act, create} from 'react-test-renderer';
import usePlanPaymentAmount, {calculatePlanPaymentAmount} from '../hooks/usePlanPaymentAmount';

const plan = {pricingWithoutGst: {monthly: 1000}, onetimeOptions: [{id: 'a', amountWithoutGst: 2000}], offer_plans_details: [{couponId: 'coupon', pricingWithoutGst: {monthly: 800}}]};
const recurring = {specificPlan: plan, selectedPlanType: 'recurring', selectedCard: 'monthly'};

test.each([
  [recurring, 1000],
  [{...recurring, configGst: true}, 1180],
  [{...recurring, appliedCoupon: {}, appliedCouponId: 'coupon', configGst: true}, 944],
  [{specificPlan: plan, selectedCard: 'onetime-a', configGst: true}, 2360],
  [{specificPlan: plan, selectedCard: 'onetime-a', appliedCoupon: {discountType: 'percentage', discountValue: 25}}, 1500],
  [{specificPlan: plan, selectedCard: 'onetime-a', appliedCoupon: {discountType: 'fixed', discountValue: 100}, configGst: true}, 2242],
  [{specificPlan: {pricingWithoutGst: {monthly: 700}, discountPercentage: 30}, selectedPlanType: 'recurring', selectedCard: 'monthly'}, 700],
  [{specificPlan: {}}, 0],
])('preserves checkout amount for %j', (options, expected) => {
  expect(calculatePlanPaymentAmount(options)).toBe(expected);
});

test('updates the parent after render and only when amount changes', async () => {
  let rendering = false;
  const update = jest.fn(() => expect(rendering).toBe(false));
  function Child({options, current}) {
    rendering = true;
    usePlanPaymentAmount(options, current, update);
    rendering = false;
    return null;
  }
  let tree;
  await act(async () => {tree = create(<Child options={recurring} current={null} />);});
  expect(update).toHaveBeenLastCalledWith(1000);
  await act(async () => {tree.update(<Child options={{...recurring}} current={1000} />);});
  expect(update).toHaveBeenCalledTimes(1);
  await act(async () => {tree.update(<Child options={{...recurring, configGst: true}} current={1000} />);});
  expect(update).toHaveBeenLastCalledWith(1180);
  await act(async () => tree.unmount());
});
