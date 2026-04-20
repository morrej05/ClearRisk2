export type PublicPricingPlan = {
  id: 'starter' | 'growth' | 'business' | 'corporate';
  name: string;
  monthly?: string;
  yearly?: string;
  employeeRange: string;
  displayPrice: string;
  ctaLabel: string;
  ctaHref: string;
  contactOnly?: boolean;
};

export const PUBLIC_PRICING_PLANS: PublicPricingPlan[] = [
  {
    id: 'starter',
    name: 'Starter',
    monthly: '£19/month',
    yearly: '£190/year',
    employeeRange: 'Up to 25 employees',
    displayPrice: '£19/month or £190/year',
    ctaLabel: 'View pricing',
    ctaHref: '/pricing',
  },
  {
    id: 'growth',
    name: 'Growth',
    monthly: '£59/month',
    yearly: '£590/year',
    employeeRange: 'Up to 100 employees',
    displayPrice: '£59/month or £590/year',
    ctaLabel: 'View pricing',
    ctaHref: '/pricing',
  },
  {
    id: 'business',
    name: 'Business',
    monthly: '£129/month',
    yearly: '£1,290/year',
    employeeRange: 'Up to 300 employees',
    displayPrice: '£129/month or £1,290/year',
    ctaLabel: 'View pricing',
    ctaHref: '/pricing',
  },
  {
    id: 'corporate',
    name: 'Corporate',
    employeeRange: '300+ employees',
    displayPrice: 'Contact us',
    ctaLabel: 'Contact us',
    ctaHref: '/pricing',
    contactOnly: true,
  },
];
