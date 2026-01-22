export type PlanType = 'core' | 'professional';
export type PlanInterval = 'month' | 'year';

export interface StripePlanMapping {
  planType: PlanType;
  interval: PlanInterval;
}

export const PRICE_TO_PLAN: Record<string, StripePlanMapping> = {
  [import.meta.env.VITE_STRIPE_PRICE_CORE_MONTHLY || '']: {
    planType: 'core',
    interval: 'month'
  },
  [import.meta.env.VITE_STRIPE_PRICE_CORE_ANNUAL || '']: {
    planType: 'core',
    interval: 'year'
  },
  [import.meta.env.VITE_STRIPE_PRICE_PRO_MONTHLY || '']: {
    planType: 'professional',
    interval: 'month'
  },
  [import.meta.env.VITE_STRIPE_PRICE_PRO_ANNUAL || '']: {
    planType: 'professional',
    interval: 'year'
  },
};

export function getPlanFromPriceId(priceId: string): StripePlanMapping | null {
  return PRICE_TO_PLAN[priceId] || null;
}

export function getDefaultPlan(): PlanType {
  return 'core';
}
