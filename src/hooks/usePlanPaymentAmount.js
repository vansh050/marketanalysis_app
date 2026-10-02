import {useEffect} from 'react';
import {withGst} from '../utils/gstHelpers';

export function calculatePlanPaymentAmount({specificPlan = {}, selectedPlanType, selectedCard, appliedCoupon, appliedCouponId, configGst}) {
  let base;
  if (selectedPlanType === 'recurring' && selectedCard) {
    const offer = appliedCoupon && specificPlan.offer_plans_details?.find(
      detail => detail.couponId?.toString() === appliedCouponId?.toString(),
    );
    base = offer
      ? Math.round(offer.pricingWithoutGst?.[selectedCard])
      : specificPlan.pricingWithoutGst?.[selectedCard];
  } else {
    const options = specificPlan.onetimeOptions || [];
    const option = options.find((item, index) => `onetime-${item.id || index}` === selectedCard);
    base = Number(option?.amountWithoutGst || options[0]?.amountWithoutGst || 0);
    if (appliedCoupon) {
      base = Math.round(appliedCoupon.discountType === 'percentage'
        ? base - base * appliedCoupon.discountValue / 100
        : base - appliedCoupon.discountValue);
    }
  }
  const amount = Number(base || 0);
  return configGst ? withGst(amount) : amount;
}

export default function usePlanPaymentAmount(options, onetimeamount, setOneTimeAmount) {
  const amount = calculatePlanPaymentAmount(options);
  // A modal must not update its parent's state during render. Commit only
  // changed totals, after rendering, including coupon and GST changes.
  useEffect(() => {
    if (!Object.is(onetimeamount, amount)) setOneTimeAmount(amount);
  }, [amount, onetimeamount, setOneTimeAmount]);
  return amount;
}
