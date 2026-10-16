import {shapeBespokePlan, shapeMpPlan} from '../../utils/alphanomyPlanShape';

describe('variant plan presentation shape', () => {
  test('exposes recurring periods and discount metadata', () => {
    expect(shapeMpPlan({
      _id: 'mp-1',
      model_name: 'Leaders',
      pricingWithoutGst: {'half-yearly': 5000, yearly: 9000},
      discountPercentage: 20,
    })).toEqual(expect.objectContaining({
      pricingOptions: [
        expect.objectContaining({period: 'half-yearly', label: '6 months', price: '₹ 5,000'}),
        expect.objectContaining({period: 'yearly', label: '12 months', price: '₹ 9,000'}),
      ],
      originalPrice: '₹ 6,250',
      saveBadge: 'Save 20%',
    }));
  });

  test('exposes bespoke validity and retention metadata', () => {
    expect(shapeBespokePlan({
      _id: 'bespoke-1',
      model_name: 'Bespoke',
      pricingWithoutGst: {quarterly: 3000},
      validity: 4,
      retentionRate: 4,
    })).toEqual(expect.objectContaining({
      priceNow: '₹ 3,000',
      validity: '4 Months',
      retentionRate: 4,
    }));
  });
});
