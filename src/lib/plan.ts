import { prisma } from '@/lib/prisma'
import { NextResponse } from 'next/server'

export const FREE_LIMITS = {
  projects: 3,
  notes: 50,
  habits: 3,
  timelineWeeks: 4,
} as const

export async function getUserPlan(userId: string): Promise<'free' | 'pro'> {
  const sub = await prisma.subscription.findUnique({
    where: { userId },
    select: { plan: true, expiresAt: true },
  })
  if (!sub || sub.plan !== 'pro') return 'free'
  if (sub.expiresAt && sub.expiresAt < new Date()) return 'free'
  return 'pro'
}

export async function assertPro(userId: string): Promise<NextResponse | null> {
  const plan = await getUserPlan(userId)
  if (plan !== 'pro') {
    return NextResponse.json(
      { error: 'Pro plan required', code: 'UPGRADE_REQUIRED' },
      { status: 402 }
    )
  }
  return null
}
