export const PRICING = {
  US: {
    currency: 'USD',
    symbol: '$',
    trial: { monthly: 0, annual: 0 },
    core: { monthly: 49, annual: 490 },
    professional: { monthly: 109, annual: 1090 },
  },
  UK: {
    currency: 'GBP',
    symbol: '£',
    trial: { monthly: 0, annual: 0 },
    core: { monthly: 39, annual: 390 },
    professional: { monthly: 89, annual: 890 },
  },
} as const;

export type Region = keyof typeof PRICING;
export type PlanTier = 'trial' | 'core' | 'professional';
export type BillingPeriod = 'monthly' | 'annual';

export function getPricing(region: Region, tier: PlanTier, period: BillingPeriod): number {
  return PRICING[region][tier][period];
}

export function formatPrice(region: Region, amount: number): string {
  const { symbol } = PRICING[region];
  return `${symbol}${amount}`;
}

export function getDefaultRegion(): Region {
  return 'UK';
}
