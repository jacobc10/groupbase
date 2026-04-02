import Stripe from 'stripe'

if (!process.env.STRIPE_SECRET_KEY) {
  throw new Error('Missing STRIPE_SECRET_KEY environment variable')
}

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: '2026-03-25.dahlia',
  typescript: true,
})

// Plan configuration
export const PLANS = {
  free: {
    name: 'Free',
    price: 0,
    priceId: null,
    productId: null,
    limits: {
      groups: 1,
      membersPerGroup: 100,
      integrations: 0,
      teamMembers: 1,
      csvExport: false,
    },
    features: [
      '1 Facebook Group',
      'Up to 100 members',
      'Basic member management',
      'Chrome extension capture',
      'Member search & filter',
    ],
  },
  pro: {
    name: 'Pro',
    price: 47,
    priceId: 'price_1THe7NL2EaIMTpl4dVX1ZlEo',
    productId: 'prod_UGAS73E6pxIlK0',
    limits: {
      groups: 3,
      membersPerGroup: -1, // unlimited
      integrations: 5,
      teamMembers: 3,
      csvExport: true,
    },
    features: [
      'Up to 3 Facebook Groups',
      'Unlimited members',
      'CSV export & import',
      'Webhook integrations',
      'Tags & bulk actions',
      'Priority support',
    ],
  },
  enterprise: {
    name: 'Enterprise',
    price: 97,
    priceId: 'price_1THe7OL2EaIMTpl4BHjXjApU',
    productId: 'prod_UGAS7O1q1DdhOQ',
    limits: {
      groups: -1, // unlimited
      membersPerGroup: -1,
      integrations: -1,
      teamMembers: -1,
      csvExport: true,
    },
    features: [
      'Unlimited Facebook Groups',
      'Unlimited members',
      'All integrations (GoHighLevel, Mailchimp, Zapier)',
      'Team management & roles',
      'CSV export & import',
      'White-glove onboarding',
      'Dedicated support',
    ],
  },
} as const

export type PlanKey = keyof typeof PLANS

export function getPlanLimits(plan: PlanKey) {
  return PLANS[plan].limits
}
