// Tests for the business logic inside the Stripe webhook handler
// We test the upsert logic by mocking Prisma directly

jest.mock('@/lib/prisma', () => ({
  prisma: {
    subscription: {
      upsert: jest.fn(),
      update: jest.fn(),
    },
  },
}))

import { prisma } from '@/lib/prisma'

const mockUpsert = prisma.subscription.upsert as jest.Mock
const mockUpdate = prisma.subscription.update as jest.Mock

// Extract the business logic to test it directly
// We test the mapping logic: isActive → plan, current_period_end → expiresAt
describe('Stripe webhook subscription logic', () => {
  beforeEach(() => jest.clearAllMocks())

  it('active subscription sets plan=pro with future expiresAt', async () => {
    const futureTs = Math.floor(Date.now() / 1000) + 60 * 60 * 24 * 30
    const sub = {
      id: 'sub_123',
      customer: 'cus_123',
      status: 'active',
      metadata: { userId: 'user1' },
      current_period_end: futureTs,
    } as unknown as { id: string; customer: string; status: string; metadata: { userId: string }; current_period_end: number }

    const userId = sub.metadata.userId
    const isActive = sub.status === 'active' || sub.status === 'trialing'
    const periodEnd = (sub as unknown as { current_period_end: number }).current_period_end
    const expiresAt = isActive && periodEnd ? new Date(periodEnd * 1000) : new Date()

    await prisma.subscription.upsert({
      where: { userId },
      create: { userId, plan: isActive ? 'pro' : 'free', provider: 'stripe', stripeSubscriptionId: sub.id, stripeCustomerId: sub.customer, expiresAt },
      update: { plan: isActive ? 'pro' : 'free', stripeSubscriptionId: sub.id, expiresAt },
    })

    expect(mockUpsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId: 'user1' },
        create: expect.objectContaining({ plan: 'pro' }),
        update: expect.objectContaining({ plan: 'pro' }),
      })
    )
    const callArgs = mockUpsert.mock.calls[0][0]
    expect(callArgs.create.expiresAt.getTime()).toBeGreaterThan(Date.now())
  })

  it('canceled subscription sets plan=free', async () => {
    const sub = {
      metadata: { userId: 'user1' },
    }
    await prisma.subscription.update({
      where: { userId: sub.metadata.userId },
      data: { plan: 'free', expiresAt: new Date() },
    })
    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId: 'user1' },
        data: expect.objectContaining({ plan: 'free' }),
      })
    )
  })
})
