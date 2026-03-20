import Stripe from "stripe";

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2024-04-10",
  typescript: true,
});

export const PLANS = {
  free: {
    name: "Free",
    description: "For individuals getting started",
    price: { monthly: 0, yearly: 0 },
    stripePriceId: { monthly: null, yearly: null },
    features: [
      "Up to 3 projects",
      "Basic analytics",
      "Community support",
      "1 team member",
    ],
    limits: {
      projects: 3,
      teamMembers: 1,
    },
  },
  pro: {
    name: "Pro",
    description: "For professionals and small teams",
    price: { monthly: 19, yearly: 190 },
    stripePriceId: {
      monthly: process.env.STRIPE_PRO_MONTHLY_PRICE_ID ?? null,
      yearly: process.env.STRIPE_PRO_YEARLY_PRICE_ID ?? null,
    },
    features: [
      "Unlimited projects",
      "Advanced analytics",
      "Priority email support",
      "Up to 5 team members",
      "Custom integrations",
      "API access",
    ],
    limits: {
      projects: -1,
      teamMembers: 5,
    },
  },
  business: {
    name: "Business",
    description: "For growing businesses",
    price: { monthly: 49, yearly: 490 },
    stripePriceId: {
      monthly: process.env.STRIPE_BUSINESS_MONTHLY_PRICE_ID ?? null,
      yearly: process.env.STRIPE_BUSINESS_YEARLY_PRICE_ID ?? null,
    },
    features: [
      "Everything in Pro",
      "Unlimited team members",
      "SSO authentication",
      "Advanced security",
      "Dedicated support",
      "Custom contracts",
      "SLA guarantee",
    ],
    limits: {
      projects: -1,
      teamMembers: -1,
    },
  },
} as const;

export type PlanKey = keyof typeof PLANS;

export function getPlanFromPriceId(priceId: string): PlanKey {
  for (const [key, plan] of Object.entries(PLANS)) {
    if (
      plan.stripePriceId.monthly === priceId ||
      plan.stripePriceId.yearly === priceId
    ) {
      return key as PlanKey;
    }
  }
  return "free";
}
