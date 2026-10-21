import { buildFeaturedPlans } from '../../utils/featuredPlans';

const mp = (name, extra = {}) => ({ _id: name, name, type: 'model portfolio', pricing: { monthly: 100 }, ...extra });
const bes = (name, extra = {}) => ({ _id: name, name, type: 'bespoke', pricing: { monthly: 100 }, ...extra });

describe('buildFeaturedPlans (admin-curated, any plan type)', () => {
  it('is empty when the admin featured nothing', () => {
    expect(buildFeaturedPlans([mp('A')], [bes('B')])).toEqual([]);
  });

  it('includes featured bespoke and MP plans, ordered by priority, unranked last', () => {
    const out = buildFeaturedPlans(
      [mp('MP1', { is_featured: true }), mp('MP2', { is_featured: true, priority: 2 }), mp('MP3')],
      [bes('B1', { is_featured: true, priority: 1 })],
    );
    expect(out.map(p => [p.name, p.kind])).toEqual([
      ['B1', 'bespoke'], ['MP2', 'mp'], ['MP1', 'mp'],
    ]);
    expect(out[0].raw._id).toBe('B1');
  });

  it('keeps the MP billing label out of the rebalance field', () => {
    const [p] = buildFeaturedPlans([mp('MP1', { is_featured: true, portfolioUpdateCycle: 'Quarterly' })], []);
    expect(p.rebalance).toBe('Quarterly');
  });
});
