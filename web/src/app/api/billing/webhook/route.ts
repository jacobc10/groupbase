import { NextResponse } from 'next/server'
import { stripe } from '@/lib/stripe'
import { createClient } from '@supabase/supabase-js'
import type Stripe from 'stripe'

// Use service role for webhook — no user context
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(request: Request) {
  const body = await request.text()
  const signature = request.headers.get('stripe-signature')

  if (!signature || !process.env.STRIPE_WEBHOOK_SECRET) {
    return NextResponse.json({ error: 'Missing signature or webhook secret' }, { status: 400 })
  }

  let event: Stripe.Event

  try {
    event = stripe.webhooks.constructEvent(
      body,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET
    )
  } catch (err) {
    console.error('Webhook signature verification failed:', err)
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 })
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session
        if (session.mode === 'subscription' && session.subscription) {
          const subscription = await stripe.subscriptions.retrieve(
            session.subscription as string
          )
          const userId = subscription.metadata.supabase_user_id
          const plan = subscription.metadata.plan

          if (userId && plan) {
            await supabaseAdmin
              .from('profiles')
              .update({
                plan: plan,
                stripe_customer_id: session.customer as string,
                updated_at: new Date().toISOString(),
              })
              .eq('id', userId)

            console.log(`[Webhook] User ${userId} upgraded to ${plan}`)
          }
        }
        break
      }

      case 'customer.subscription.updated': {
        const subscription = event.data.object as Stripe.Subscription
        const userId = subscription.metadata.supabase_user_id

        if (userId) {
          // Check if subscription is still active
          if (subscription.status === 'active') {
            const plan = subscription.metadata.plan || 'pro'
            await supabaseAdmin
              .from('profiles')
              .update({
                plan: plan,
                updated_at: new Date().toISOString(),
              })
              .eq('id', userId)

            console.log(`[Webhook] User ${userId} subscription updated to ${plan}`)
          }
        }
        break
      }

      case 'customer.subscription.deleted': {
        const subscription = event.data.object as Stripe.Subscription
        const userId = subscription.metadata.supabase_user_id

        if (userId) {
          // Downgrade to free
          await supabaseAdmin
            .from('profiles')
            .update({
              plan: 'free',
              updated_at: new Date().toISOString(),
            })
            .eq('id', userId)

          console.log(`[Webhook] User ${userId} downgraded to free (subscription cancelled)`)
        }
        break
      }

      case 'invoice.payment_failed': {
        const invoice = event.data.object as Stripe.Invoice
        const customerId = invoice.customer as string

        // Find user by Stripe customer ID
        const { data: profile } = await supabaseAdmin
          .from('profiles')
          .select('id')
          .eq('stripe_customer_id', customerId)
          .single()

        if (profile) {
          console.log(`[Webhook] Payment failed for user ${profile.id}`)
          // Could send notification, add grace period, etc.
        }
        break
      }

      default:
        console.log(`[Webhook] Unhandled event type: ${event.type}`)
    }

    return NextResponse.json({ received: true })
  } catch (error) {
    console.error('Webhook processing error:', error)
    return NextResponse.json(
      { error: 'Webhook processing failed' },
      { status: 500 }
    )
  }
}
