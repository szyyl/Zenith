import type {ProductData} from './types';

const USD_FORMATTER = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
});

export const formatUsd = (value: number) => USD_FORMATTER.format(value);

export const formatCompactNumber = (value: number) =>
  value >= 10000 ? `${(value / 10000).toFixed(1)}w` : value.toLocaleString();

export interface GtmProjection {
  contentVolume: number;
  contentCost: number;
  adsVolume: number;
  adsCost: number;
  referralVolume: number;
  viralVolume: number;
  seoVolume: number;
  kFactor: number;
  adsConversionRate: number;
  referralConversionRate: number;
  contentSpend: number;
  adsSpend: number;
  totalMarketingSpend: number;
  contentSpendPercent: number;
  adsSpendPercent: number;
  totalImpressions: number;
  contentInstalls: number;
  adsInstalls: number;
  seoInstalls: number;
  referralInstalls: number;
  directInstalls: number;
  viralInstalls: number;
  totalNewUsers: number;
  estimatedMauFromGtm: number;
  mauTarget: number;
  paidConversionRate: number;
  monthlySubscription: number;
  dailyFreeUses: number;
  costPerCall: number;
  paidUsers: number;
  revenue: number;
  totalCalls: number;
  modelCost: number;
  profit: number;
  marginPercent: number;
  customerAcquisitionCost: number | null;
  estimatedPaidUsersFromGtm: number;
  channelMaxVolume: number;
  radarData: Array<{channel: string; value: number; fullMark: number}>;
  barData: Array<{name: string; value: number; fill: string}>;
}

export const computeGtmProjection = (project?: ProductData): GtmProjection => {
  const gtmStrategy = project?.gtmStrategy;
  const costStructure = project?.costStructure;

  const contentVolume = gtmStrategy?.contentMarketing?.volume || 0;
  const contentCost = gtmStrategy?.contentMarketing?.unitCost || 0;
  const adsVolume = gtmStrategy?.paidAds?.volume || 0;
  const adsCost = gtmStrategy?.paidAds?.unitCost || 0;
  const referralVolume = gtmStrategy?.referral?.volume || 0;
  const viralVolume = gtmStrategy?.viral?.volume || 0;
  const seoVolume = gtmStrategy?.seoAso?.volume || 0;

  const kFactor = gtmStrategy?.viral?.kFactor || 1.2;
  const adsConversionRate = gtmStrategy?.paidAds?.cvr || 5;
  const referralConversionRate = gtmStrategy?.referral?.cvr || 10;

  const contentSpend = contentVolume * contentCost;
  const adsSpend = adsVolume * adsCost;
  const totalMarketingSpend = contentSpend + adsSpend;
  const contentSpendPercent =
    totalMarketingSpend > 0
      ? Math.round((contentSpend / totalMarketingSpend) * 100)
      : 0;
  const adsSpendPercent =
    totalMarketingSpend > 0
      ? Math.round((adsSpend / totalMarketingSpend) * 100)
      : 0;

  const adsReach = adsVolume * 2500;
  const seoReach = seoVolume * 500;
  const totalImpressions = adsReach;

  const contentInstalls = 0;
  const adsInstalls = Math.floor(adsReach * (adsConversionRate / 100));
  const seoInstalls = Math.floor(seoReach * 0.08);
  const referralInstalls = Math.floor(
    referralVolume * (referralConversionRate / 100),
  );

  const directInstalls =
    contentInstalls + adsInstalls + seoInstalls + referralInstalls;
  const viralInstalls = Math.floor(directInstalls * (kFactor - 1));
  const totalNewUsers = directInstalls + viralInstalls;
  const estimatedMauFromGtm = Math.floor(directInstalls * kFactor);

  const mauTarget = costStructure?.targetMau ?? 100000;
  const paidConversionRate = costStructure?.paidConversionRate ?? 3;
  const monthlySubscription = costStructure?.monthlySubscription ?? 19.99;
  const dailyFreeUses = costStructure?.dailyFreeUses ?? 5;
  const costPerCall = costStructure?.costPerCall ?? 0.01;

  const paidUsers = mauTarget * (paidConversionRate / 100);
  const revenue = paidUsers * monthlySubscription;
  const totalCalls = mauTarget * dailyFreeUses * 30;
  const modelCost = totalCalls * costPerCall;
  const profit = revenue - modelCost - totalMarketingSpend;
  const marginPercent = revenue > 0 ? (profit / revenue) * 100 : 0;
  const customerAcquisitionCost =
    totalNewUsers > 0 ? totalMarketingSpend / totalNewUsers : null;
  const estimatedPaidUsersFromGtm = Math.floor(
    estimatedMauFromGtm * (paidConversionRate / 100),
  );

  const channelMaxVolume = Math.max(
    contentVolume,
    adsVolume,
    referralVolume,
    viralVolume,
    seoVolume,
    5,
  );

  return {
    contentVolume,
    contentCost,
    adsVolume,
    adsCost,
    referralVolume,
    viralVolume,
    seoVolume,
    kFactor,
    adsConversionRate,
    referralConversionRate,
    contentSpend,
    adsSpend,
    totalMarketingSpend,
    contentSpendPercent,
    adsSpendPercent,
    totalImpressions,
    contentInstalls,
    adsInstalls,
    seoInstalls,
    referralInstalls,
    directInstalls,
    viralInstalls,
    totalNewUsers,
    estimatedMauFromGtm,
    mauTarget,
    paidConversionRate,
    monthlySubscription,
    dailyFreeUses,
    costPerCall,
    paidUsers,
    revenue,
    totalCalls,
    modelCost,
    profit,
    marginPercent,
    customerAcquisitionCost,
    estimatedPaidUsersFromGtm,
    channelMaxVolume,
    radarData: [
      {channel: '内容', value: contentVolume, fullMark: channelMaxVolume},
      {channel: '付费', value: adsVolume, fullMark: channelMaxVolume},
      {channel: '裂变', value: referralVolume, fullMark: channelMaxVolume},
      {channel: '自传播', value: viralVolume, fullMark: channelMaxVolume},
      {channel: 'SEO', value: seoVolume, fullMark: channelMaxVolume},
    ],
    barData: [
      {name: '营收', value: revenue, fill: '#10b981'},
      {name: '模型成本', value: modelCost, fill: '#f43f5e'},
      {name: '营销成本', value: totalMarketingSpend, fill: '#f43f5e'},
    ],
  };
};
