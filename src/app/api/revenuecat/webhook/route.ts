import { timingSafeEqual } from 'crypto'
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function POST(request: NextRequest) {
  const authHeader = request.headers.get('authorization')
  const secret = process.env.REVENUECAT_WEBHOOK_AUTH_KEY
  const isValid =
    secret &&
    authHeader &&
    authHeader.length === secret.length &&
    timingSafeEqual(Buffer.from(authHeader), Buffer.from(secret))
  if (!isValid) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await request.json()
  const event = body.event
  const userId = event?.app_user_id as string | undefined

  if (!userId) return NextResponse.json({ received: true })

  const activeTypes = [
    'INITIAL_PURCHASE',
    'RENEWAL',
    'PRODUCT_CHANGE',
    'UNCANCELLATION',
  ]
  const cancelTypes = ['CANCELLATION', 'EXPIRATION', 'BILLING_ISSUE']

  if (activeTypes.includes(event.type)) {
    const expiresAt = event.expiration_at_ms
      ? new Date(event.expiration_at_ms)
      : null
    await prisma.subscription.upsert({
      where: { userId },
      create: { userId, plan: 'pro', provider: 'revenuecat', expiresAt },
      update: { plan: 'pro', provider: 'revenuecat', expiresAt },
    })
  } else if (cancelTypes.includes(event.type)) {
    await prisma.subscription.upsert({
      where: { userId },
      create: { userId, plan: 'free', provider: 'revenuecat' },
      update: { plan: 'free', expiresAt: new Date() },
    })
  }

  return NextResponse.json({ received: true })
}
