import React from 'react';
import renderer from 'react-test-renderer';

import LowFundsRebalanceWarning from '../src/components/LowFundsRebalanceWarning';

describe('LowFundsRebalanceWarning funding policy', () => {
  it('starts compact and reveals shortfall plus T1 detail on demand', () => {
    let tree;
    renderer.act(() => {
      tree = renderer.create(
        <LowFundsRebalanceWarning
          availableCash={648176.7}
          additionalFundsRequired={14347.1}
          fundingGapToday={19347.1}
          deferredSellProceeds={5000}
          t1RiskCost={5000}
          t1RiskLegCount={2}
          fundingAdjusted
        />,
      );
    });
    let rendered = JSON.stringify(tree.toJSON());
    expect(rendered).toContain('Orders fitted to available funds');
    expect(rendered).toContain('View details');
    expect(rendered).not.toContain('The remaining quantity needs about ₹');

    renderer.act(() => {
      tree.root.findByProps({accessibilityLabel: 'Toggle funding details'}).props.onPress();
    });
    rendered = JSON.stringify(tree.toJSON());
    expect(rendered).toContain('The remaining quantity needs about ₹');
    expect(rendered).toContain('it does not block these orders');
    expect(rendered).toContain('depends on T1 sale proceeds');
    expect(rendered).toContain('No additional deposit is required for this T1-only portion');
    expect(rendered).toContain('Hide details');
  });
});
