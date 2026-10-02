import React from 'react';
import renderer, {act} from 'react-test-renderer';
import SellModelImpactNotice from '../components/AdviceScreenComponents/SellModelImpactNotice';

const one = {
  symbol: 'ABC-EQ', requested: 45, freeQuantity: 40, fromModels: 5,
  models: [{modelName: 'Model B', savedQuantity: 30}],
};
const textOf = tree => JSON.stringify(tree.toJSON());
const mount = el => {
  let tree;
  act(() => {
    tree = renderer.create(el);
  });
  return tree;
};

describe('SellModelImpactNotice (app)', () => {
  it('states the shortfall and both choices, never "needs a rebalance"', () => {
    const tree = mount(<SellModelImpactNotice notice={one} onChoose={() => {}} />);
    const text = textOf(tree);
    expect(text).toContain('5 of these 45 ABC shares belong to');
    expect(text).toContain('Sell only the 40 free shares');
    expect(text).toContain("Model B's saved quantity from 30 to 25");
    expect(text).toContain('goes ahead as entered');
    expect(text).not.toMatch(/need a rebalance/i);
  });

  it('reports the tapped choice', () => {
    const onChoose = jest.fn();
    const tree = mount(<SellModelImpactNotice notice={one} onChoose={onChoose} />);
    act(() => tree.root.findByProps({testID: 'sell-impact-all'}).props.onPress());
    expect(onChoose).toHaveBeenCalledWith('all', 'Model B');
  });

  it('with several models offers a chip per model', () => {
    const onChoose = jest.fn();
    const two = {...one, models: [{modelName: 'Model A', savedQuantity: 40}, ...one.models]};
    const tree = mount(<SellModelImpactNotice notice={two} choice="all" onChoose={onChoose} />);
    act(() => tree.root.findByProps({accessibilityLabel: 'Take ABC shares from Model B'}).props.onPress());
    expect(onChoose).toHaveBeenCalledWith('all', 'Model B');
  });
});
