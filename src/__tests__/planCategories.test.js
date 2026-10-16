/**
 * Bespoke plan categories on customer surfaces (web repo
 * docs/BESPOKE_PLAN_CATEGORIES.md).
 */
import fs from 'fs';
import path from 'path';
import {
  attachCategoryImages,
  modelPortfolioCategoryImage,
  categoryImageKey,
  categoryImagesFromRows,
  groupBespokePlansByCategory,
  normalizeBespokeCategory,
  planMatchesBespokeCategory,
} from '../utils/planCategories';

const read = rel => fs.readFileSync(path.join(__dirname, '..', rel), 'utf8');

describe('groupBespokePlansByCategory', () => {
  const plans = [
    {id: 1, category: 'Intraday'},
    {id: 2, category: null},
    {id: 3, category: ' intraday '},
    {id: 4, category: 'Ethical'},
  ];

  test('groups case-insensitively in catalogue order, uncategorised last', () => {
    const groups = groupBespokePlansByCategory(plans);
    expect(groups.map(g => [g.label, g.plans.map(p => p.id)])).toEqual([
      ['Intraday', [1, 3]],
      ['Ethical', [4]],
      ['Bespoke', [2]],
    ]);
    expect(groups[2].name).toBeNull();
  });

  test('no plans means no groups', () => {
    expect(groupBespokePlansByCategory([])).toEqual([]);
  });

  test('filter: undefined = all, null = uncategorised, name ignores case', () => {
    expect(plans.filter(p => planMatchesBespokeCategory(p, undefined))).toHaveLength(4);
    expect(plans.filter(p => planMatchesBespokeCategory(p, null)).map(p => p.id)).toEqual([2]);
    expect(plans.filter(p => planMatchesBespokeCategory(p, 'INTRADAY')).map(p => p.id)).toEqual([1, 3]);
  });
});

describe('category images', () => {
  test('rows become a lookup by kind + normalised name', () => {
    const images = categoryImagesFromRows([
      {kind: 'bespoke', name: 'Intraday', image: 'https://img/i.png'},
      {kind: 'model portfolio', name: 'Model Portfolio', image: 'https://img/m.png'},
      {kind: 'bespoke', name: 'Ethical', image: null},
    ]);
    expect(images[categoryImageKey('bespoke', ' intraday')]).toBe('https://img/i.png');
    expect(images[categoryImageKey('model portfolio', 'Model Portfolio')]).toBe('https://img/m.png');
    expect(images[categoryImageKey('bespoke', 'Ethical')]).toBeUndefined();
  });

  test('groups carry their resolved image; model portfolio image resolved too', () => {
    const images = {[categoryImageKey('bespoke', 'Intraday')]: 'i', [categoryImageKey('model portfolio', 'Model Portfolio')]: 'm'};
    const groups = attachCategoryImages([{name: 'Intraday', plans: []}, {name: null, plans: []}], images);
    expect(groups.map(g => g.image)).toEqual(['i', null]);
    expect(modelPortfolioCategoryImage(images)).toBe('m');
  });

  test('normalisation matches the backend', () => {
    expect(normalizeBespokeCategory('  Swing   Trades ')).toBe('Swing Trades');
    expect(normalizeBespokeCategory('   ')).toBeNull();
  });
});

describe('containers expose category data to variants', () => {
  test('shaped bespoke plans carry their category', () => {
    expect(read('utils/alphanomyPlanShape.js')).toContain('category: normalizeBespokeCategory(plan.bespoke_category)');
  });

  test('Home passes groups, images and catalogue entry points', () => {
    const home = read('screens/Home/HomeScreen.js');
    expect(home).toContain('bespokeCategoryGroups: attachCategoryImages(bespokeCategoryGroups, categoryImages)');
    expect(home).toContain('modelPortfolioCategoryImage: modelPortfolioCategoryImage(categoryImages)');
    expect(home).toContain("navigation.navigate('Plans', {kind: 'bespoke', bespokeCategory: category ?? null})");
  });

  test('Plans honours the bespokeCategory param and clears it', () => {
    const plans = read('screens/Drawer/ModelPortfolioScreen.js');
    expect(plans).toContain('setBespokeCategoryFilter(');
    expect(plans.match(/bespokeCategory: undefined/g)).toHaveLength(2);
    expect(plans).toContain('onBespokeCategoryChange: setBespokeCategoryFilter');
    // Params survive until the target tab exists (cold navigate from Home).
    expect(plans).toContain('if (tabIdx < 0) return;');
  });
});
