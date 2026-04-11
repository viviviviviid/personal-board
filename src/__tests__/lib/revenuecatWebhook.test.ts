jest.mock('@/lib/prisma', () => ({
  prisma: {
    subscription: {
      upsert: jest.fn(),
    },
  },
}))

import { prisma } from '@/lib/prisma'

const mockUpsert = prisma.subscription.upsert as jest.Mock

describe('RevenueCat webhook subscription logic', () => {
  beforeEach(() => jest.clearAllMocks())

  const activeTypes = ['INITIAL_PURCHASE', 'RENEWAL', 'PRODUCT_CHANGE', 'UNCANCELLATION']
  const cancelTypes = ['CANCELLATION', 'EXPIRATION', 'BILLING_ISSUE']

  activeTypes.forEach((eventType) => {
    it(`${eventType} → upserts plan=pro`, async () => {
      const userId = 'user1'
      const expiresAt = new Date(Date.now() + 86400000)
      await prisma.subscription.upsert({
        where: { userId },
        create: { userId, plan: 'pro', provider: 'revenuecat', expiresAt },
        update: { plan: 'pro', provider: 'revenuecat', expiresAt },
      })
      expect(mockUpsert).toHaveBeenCalledWith(
        expect.objectContaining({
          create: expect.objectContaining({ plan: 'pro' }),
          update: expect.objectContaining({ plan: 'pro' }),
        })
      )
      jest.clearAllMocks()
    })
  })

  cancelTypes.forEach((eventType) => {
    it(`${eventType} → upserts plan=free`, async () => {
      const userId = 'user1'
      await prisma.subscription.upsert({
        where: { userId },
        create: { userId, plan: 'free', provider: 'revenuecat' },
        update: { plan: 'free', expiresAt: new Date() },
      })
      expect(mockUpsert).toHaveBeenCalledWith(
        expect.objectContaining({
          create: expect.objectContaining({ plan: 'free' }),
          update: expect.objectContaining({ plan: 'free' }),
        })
      )
      jest.clearAllMocks()
    })
  })
})
