export type PlanId = 'free' | 'pro' | 'ai';

export interface Plan {
  id: PlanId;
  name: string;
  priceInr: number;
  period: 'forever' | 'month';
  tagline: string;
  /** Max number of saved links. null = unlimited. */
  linkLimit: number | null;
  /** Max number of saved notes. null = unlimited. */
  noteLimit: number | null;
  searchType: 'indexed' | 'ai';
  highlight?: boolean;
  features: string[];
}

export const PLANS: Record<PlanId, Plan> = {
  free: {
    id: 'free',
    name: 'Free',
    priceInr: 0,
    period: 'forever',
    tagline: 'For getting started',
    linkLimit: 1000,
    noteLimit: null,
    searchType: 'indexed',
    features: [
      'Save up to 1,000 links',
      'Unlimited notes',
      'Fast indexed keyword search',
      'Save from any platform',
    ],
  },
  pro: {
    id: 'pro',
    name: 'Pro',
    priceInr: 99,
    period: 'month',
    tagline: 'For power savers',
    linkLimit: null,
    noteLimit: null,
    searchType: 'indexed',
    highlight: true,
    features: [
      'Unlimited link storage',
      'Unlimited notes',
      'Fast indexed keyword search',
      'Save from any platform',
      'Priority support',
    ],
  },
  ai: {
    id: 'ai',
    name: 'AI',
    priceInr: 199,
    period: 'month',
    tagline: 'Find anything in plain English',
    linkLimit: null,
    noteLimit: null,
    searchType: 'ai',
    features: [
      'Everything in Pro',
      'AI natural-language search across links & notes',
      'Ask questions, get the exact memory',
      'Smart auto-tagging',
    ],
  },
};

export const PLAN_LIST: Plan[] = [PLANS.free, PLANS.pro, PLANS.ai];

export function getEntitlements(planId: PlanId) {
  return {
    linkLimit: PLANS[planId].linkLimit,
    noteLimit: PLANS[planId].noteLimit,
    searchType: PLANS[planId].searchType,
  };
}
