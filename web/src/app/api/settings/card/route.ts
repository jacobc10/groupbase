import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { stripe } from '@/lib/stripe'

export async function GET() {
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
      return NextResponse.json({ card: null })
    }

    // Get customer's default payment method
    const customer = await stripe.customers.retrieve(profile.stripe_customer_id, {
      expand: ['invoice_settings.default_payment_method'],
    })

    if (customer.deleted) {
      return NextResponse.json({ card: null })
    }

    const defaultPM = customer.invoice_settings?.default_payment_method
    if (!defaultPM || typeof defaultPM === 'string') {
      // Try to get from subscriptions
      const subscriptions = await stripe.subscriptions.list({
        customer: profile.stripe_customer_id,
        status: 'active',
        limit: 1,
        expand: ['data.default_payment_method'],
      })

      if (subscriptions.data.length > 0) {
        const subPM = subscriptions.data[0].default_payment_method
        if (subPM && typeof subPM !== 'string' && subPM.type === 'card') {
          return NextResponse.json({
            card: {
              brand: subPM.card?.brand || 'unknown',
              last4: subPM.card?.last4 || '****',
              exp_month: subPM.card?.exp_month,
              exp_year: subPM.card?.exp_year,
            },
          })
        }
      }

      return NextResponse.json({ card: null })
    }

    if (defaultPM.type === 'card') {
      return NextResponse.json({
        card: {
          brand: defaultPM.card?.brand || 'unknown',
          last4: defaultPM.card?.last4 || '****',
          exp_month: defaultPM.card?.exp_month,
          exp_year: defaultPM.card?.exp_year,
        },
      })
    }

    return NextResponse.json({ card: null })
  } catch (error) {
    console.error('Card fetch error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch card details' },
      { status: 500 }
    )
  }
}
