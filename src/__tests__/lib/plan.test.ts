import { getUserPlan, assertPro, FREE_LIMITS } from '@/lib/plan'

jest.mock('@/lib/prisma', () => ({
  prisma: {
    subscription: {
      findUnique: jest.fn(),
    },
  },
}))

import { prisma } from '@/lib/prisma'

const mockFindUnique = prisma.subscription.findUnique as jest.Mock

describe('getUserPlan', () => {
  beforeEach(() => jest.clearAllMocks())

  it('구독 레코드 없으면 free 반환', async () => {
    mockFindUnique.mockResolvedValue(null)
    expect(await getUserPlan('user1')).toBe('free')
  })

  it('plan이 free면 free 반환', async () => {
    mockFindUnique.mockResolvedValue({ plan: 'free', expiresAt: null })
    expect(await getUserPlan('user1')).toBe('free')
  })

  it('plan이 pro이고 expiresAt 없으면 pro 반환', async () => {
    mockFindUnique.mockResolvedValue({ plan: 'pro', expiresAt: null })
    expect(await getUserPlan('user1')).toBe('pro')
  })

  it('expiresAt이 미래면 pro 반환', async () => {
    const future = new Date(Date.now() + 1000 * 60 * 60 * 24 * 30)
    mockFindUnique.mockResolvedValue({ plan: 'pro', expiresAt: future })
    expect(await getUserPlan('user1')).toBe('pro')
  })

  it('expiresAt이 과거면 free 반환', async () => {
    const past = new Date(Date.now() - 1000)
    mockFindUnique.mockResolvedValue({ plan: 'pro', expiresAt: past })
    expect(await getUserPlan('user1')).toBe('free')
  })
})

describe('assertPro', () => {
  beforeEach(() => jest.clearAllMocks())

  it('pro 플랜이면 null 반환', async () => {
    mockFindUnique.mockResolvedValue({ plan: 'pro', expiresAt: null })
    const result = await assertPro('user1')
    expect(result).toBeNull()
  })

  it('free 플랜이면 402 NextResponse 반환', async () => {
    mockFindUnique.mockResolvedValue({ plan: 'free', expiresAt: null })
    const result = await assertPro('user1')
    expect(result).not.toBeNull()
    expect(result?.status).toBe(402)
    const body = await result?.json()
    expect(body.code).toBe('UPGRADE_REQUIRED')
  })
})

describe('FREE_LIMITS', () => {
  it('정의된 한도값 검증', () => {
    expect(FREE_LIMITS.projects).toBe(3)
    expect(FREE_LIMITS.notes).toBe(50)
    expect(FREE_LIMITS.habits).toBe(3)
    expect(FREE_LIMITS.timelineWeeks).toBe(4)
  })
})
