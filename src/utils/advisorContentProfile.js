import {
  MONEYMAN_CARD_ACCENT_FROM_CARD_COLOR,
  MONEYMAN_HIDE_BACKGROUND_LOGO,
  MONEYMAN_HOME_FEED_RESTRUCTURE,
  MONEYMAN_INSIGHTS_URL,
  MONEYMAN_MORE_LINKS,
  MONEYMAN_PLAN_CARDS,
  MONEYMAN_PLAN_ORDERING,
  PLATFORM_DISPLAY_NAME,
  getMoneyManPlanColor,
  getMoneyManPlanSummary,
} from './whitelabelContent';
import {getRuntimeAppVariant} from './runtimeAdvisor';
import {designColor} from '../design/literalTokens';

const RUNTIME_MONEYMAN_PLAN_CARDS = [
  {
    keys: ['MAMM', 'ABSOLUTE MOMENTUM'],
    code: 'MAMM',
    title: 'MoneyMan Absolute Momentum Multiplier',
    color: designColor('005A00'),
    summary:
      'Opportunity to create wealth with fast-moving stocks from leading sectors in the Indian markets. A concentrated, higher-risk portfolio of up to 10 stocks, rebalanced weekly.',
  },
  {
    keys: ['MFCC', 'FACTOR CHAMPIONS'],
    code: 'MFCC',
    title: 'MoneyMan Factor Champions Compounder',
    color: designColor('6C2487'),
    summary:
      'Opportunity to compound wealth with fundamentally and technically strong stocks in the Indian markets. A diversified, medium-risk portfolio of up to 20 stocks, rebalanced monthly.',
  },
  {
    keys: ['MSRO', 'SECTOR ROTATION'],
    code: 'MSRO',
    title: 'MoneyMan Sector Rotation Optimizer',
    color: designColor('00005A'),
    summary:
      'Opportunity for passive outperformance using low-cost ETFs from the strongest market sectors. A diversified, lower-risk portfolio of up to 5 ETFs, rebalanced fortnightly.',
  },
];

const RUNTIME_MONEYMAN_MORE_LINKS = [
  ['About', 'about'],
  ['Connect', 'contact-us'],
  ['Disclaimer', 'disclaimer'],
  ['Disclosures', 'disclosures'],
  ['Grievance Redressal', 'grievance-redressal'],
  ['Investor Complaints & Grievances', 'investor-complaints-grievances'],
  ['Investor Charter', 'investor-charter'],
  ['Code Of Conduct', 'code-of-conduct'],
].map(([label, slug]) => ({
  label,
  url: `https://www.moneymaninvestments.com/moneyman-site/${slug}/index.html`,
}));

const isRuntimeMoneyMan = () =>
  String(getRuntimeAppVariant() || '').toLowerCase() === 'moneyman';

const findRuntimeMoneyManPlan = planName => {
  const normalizedName = String(planName || '').toUpperCase();
  return (
    RUNTIME_MONEYMAN_PLAN_CARDS.find(plan =>
      plan.keys.some(key => normalizedName.includes(key)),
    ) || null
  );
};

export const getAdvisorContentProfile = () => {
  if (isRuntimeMoneyMan()) {
    return {
      platformDisplayName: 'MoneyMan Investments',
      insightsUrl: 'https://www.moneymaninvestments.com/insights/',
      moreLinks: RUNTIME_MONEYMAN_MORE_LINKS,
      planCards: RUNTIME_MONEYMAN_PLAN_CARDS,
      planOrdering: 'fixed',
      cardAccentFromCardColor: true,
      hideBackgroundLogo: true,
      homeFeedRestructure: true,
    };
  }

  return {
    platformDisplayName: PLATFORM_DISPLAY_NAME,
    insightsUrl: MONEYMAN_INSIGHTS_URL,
    moreLinks: MONEYMAN_MORE_LINKS,
    planCards: MONEYMAN_PLAN_CARDS,
    planOrdering: MONEYMAN_PLAN_ORDERING,
    cardAccentFromCardColor: MONEYMAN_CARD_ACCENT_FROM_CARD_COLOR,
    hideBackgroundLogo: MONEYMAN_HIDE_BACKGROUND_LOGO,
    homeFeedRestructure: MONEYMAN_HOME_FEED_RESTRUCTURE,
  };
};

export const getAdvisorPlanColor = planName =>
  isRuntimeMoneyMan()
    ? findRuntimeMoneyManPlan(planName)?.color || null
    : getMoneyManPlanColor(planName);

export const getAdvisorPlanSummary = (planName, fallback = '') =>
  isRuntimeMoneyMan()
    ? findRuntimeMoneyManPlan(planName)?.summary || fallback
    : getMoneyManPlanSummary(planName, fallback);

export const getPlatformDisplayName = () =>
  getAdvisorContentProfile().platformDisplayName;
