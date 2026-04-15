import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'
import { prisma } from '@/lib/prisma'

export async function POST(request: NextRequest) {
  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!)
  const body = await request.text()
  const sig = request.headers.get('stripe-signature')
  if (!sig) return NextResponse.json({ error: 'Missing signature' }, { status: 400 })

  if (!process.env.STRIPE_WEBHOOK_SECRET) {
    console.error('STRIPE_WEBHOOK_SECRET is not configured')
    return NextResponse.json({ error: 'Server misconfiguration' }, { status: 500 })
  }

  let event: Stripe.Event
  try {
    event = stripe.webhooks.constructEvent(body, sig, process.env.STRIPE_WEBHOOK_SECRET)
  } catch {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 })
  }

  const sub = event.data.object as Stripe.Subscription

  switch (event.type) {
    case 'customer.subscription.created':
    case 'customer.subscription.updated': {
      const userId = sub.metadata.userId
      if (!userId) break
      const isActive = sub.status === 'active' || sub.status === 'trialing'
      const periodEnd = (sub as unknown as { current_period_end: number }).current_period_end
      const expiresAt = isActive && periodEnd
        ? new Date(periodEnd * 1000)
        : new Date()
      await prisma.subscription.upsert({
        where: { userId },
        create: {
          userId,
          plan: isActive ? 'pro' : 'free',
          provider: 'stripe',
          stripeSubscriptionId: sub.id,
          stripeCustomerId: sub.customer as string,
          expiresAt,
        },
        update: {
          plan: isActive ? 'pro' : 'free',
          stripeSubscriptionId: sub.id,
          expiresAt,
        },
      })
      break
    }
    case 'customer.subscription.deleted': {
      const userId = sub.metadata.userId
      if (!userId) break
      await prisma.subscription.update({
        where: { userId },
        data: { plan: 'free', expiresAt: new Date() },
      })
      break
    }
  }

  return NextResponse.json({ received: true })
}
