import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { stripe } from '@/lib/stripe'

// POST: Create a billing portal session that goes directly to card update
export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('stripe_customer_id')
      .eq('id', user.id)
      .single()

    if (!profile?.stripe_customer_id) {
      return NextResponse.json(
        { error: 'No billing account found. Subscribe to a plan first.' },
        { status: 400 }
      )
    }

    // Get the active subscription for this customer
    const subscriptions = await stripe.subscriptions.list({
      customer: profile.stripe_customer_id,
      status: 'active',
      limit: 1,
    })

    const flowData = subscriptions.data.length > 0
      ? {
          type: 'payment_method_update' as const,
          payment_method_update: {
            subscription: subscriptions.data[0].id,
          },
        }
      : undefined

    const session = await stripe.billingPortal.sessions.create({
      customer: profile.stripe_customer_id,
      return_url: `${request.headers.get('origin')}/dashboard/settings?tab=card&updated=true`,
      ...(flowData ? { flow_data: flowData } : {}),
    })

    return NextResponse.json({ url: session.url })
  } catch (error) {
    console.error('Update card error:', error)
    return NextResponse.json(
      { error: 'Failed to open card update' },
      { status: 500 }
    )
  }
}
