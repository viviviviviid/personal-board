# Monetization Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Freemium SaaS 유료화 — Free 데이터 한도 + Pro(AI/Calendar/Vault 무제한) $1/월 구독 구현

**Architecture:** Stripe로 웹 결제를 처리하고 webhook으로 DB의 Subscription 테이블을 동기화한다. `src/lib/plan.ts`의 유틸 함수가 모든 API 라우트에서 플랜 상태를 단일 진입점으로 확인한다. RevenueCat webhook으로 모바일 인앱결제도 동일한 Subscription 테이블에 반영한다. 프론트엔드는 402 응답을 받으면 공통 UpgradeModal을 띄운다.

**Tech Stack:** Stripe (웹 결제), RevenueCat (모바일 인앱결제), Prisma/MySQL, Next.js App Router API Routes, React

---

## File Map

| 파일 | 역할 |
|---|---|
| `prisma/schema.prisma` | Subscription 모델 추가 |
| `src/lib/plan.ts` | getUserPlan, assertPro, FREE_LIMITS (새 파일) |
| `src/__tests__/lib/plan.test.ts` | plan.ts 유닛 테스트 (새 파일) |
| `src/app/api/stripe/checkout/route.ts` | Stripe Checkout 세션 생성 (새 파일) |
| `src/app/api/stripe/webhook/route.ts` | Stripe webhook 처리 (새 파일) |
| `src/app/api/stripe/portal/route.ts` | Stripe Customer Portal 링크 생성 (새 파일) |
| `src/app/api/revenuecat/webhook/route.ts` | RevenueCat webhook 처리 (새 파일) |
| `src/app/api/subscription/route.ts` | 현재 플랜 조회 API (새 파일) |
| `src/app/api/projects/route.ts` | POST에 Free 한도 게이팅 추가 |
| `src/app/api/habits/route.ts` | POST에 Free 한도 게이팅 추가 |
| `src/app/api/notes/route.ts` | POST에 Free 한도 게이팅 추가 |
| `src/app/api/timeline/route.ts` | GET에 4주 히스토리 제한 추가 |
| `src/app/api/ai/feedback/route.ts` | Pro 전용 게이트 추가 |
| `src/app/api/ai/daily-brief/route.ts` | Pro 전용 게이트 추가 |
| `src/app/api/ai/project/route.ts` | Pro 전용 게이트 추가 |
| `src/app/api/google-calendar/route.ts` | Pro 전용 게이트 추가 |
| `src/app/api/vault/route.ts` | Pro 전용 게이트 추가 |
| `src/components/UpgradeModal.tsx` | 업그레이드 모달 컴포넌트 (새 파일) |
| `src/components/SettingsModal.tsx` | Billing 탭 추가 |

---

## Task 1: Subscription DB 모델 추가

**Files:**
- Modify: `prisma/schema.prisma`

- [ ] **Step 1: schema.prisma에 Subscription 모델 추가**

`User` 모델 아래에 추가:

```prisma
model Subscription {
  id            String    @id @default(cuid())
  userId        String    @unique
  plan          String    @default("free") // "free" | "pro"
  provider      String?   // "stripe" | "revenuecat"
  stripeCustomerId     String?   @unique
  stripeSubscriptionId String?   @unique
  expiresAt     DateTime?
  createdAt     DateTime  @default(now())
  updatedAt     DateTime  @updatedAt
  user          User      @relation(fields: [userId], references: [id], onDelete: Cascade)
}
```

`User` 모델에도 relation 추가 (기존 `vaultConfig VaultConfig?` 줄 아래):

```prisma
  subscription  Subscription?
```

- [ ] **Step 2: DB 반영**

```bash
npx prisma db push
```

Expected: "Your database is now in sync with your Prisma schema"

- [ ] **Step 3: Commit**

```bash
git add prisma/schema.prisma
git commit -m "feat: add Subscription model to schema"
```

---

## Task 2: plan.ts 유틸 + 테스트

**Files:**
- Create: `src/lib/plan.ts`
- Create: `src/__tests__/lib/plan.test.ts`

- [ ] **Step 1: 테스트 파일 작성**

```typescript
// src/__tests__/lib/plan.test.ts
import { getUserPlan, FREE_LIMITS } from '@/lib/plan'

// Prisma mock
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

describe('FREE_LIMITS', () => {
  it('정의된 한도값 검증', () => {
    expect(FREE_LIMITS.projects).toBe(3)
    expect(FREE_LIMITS.notes).toBe(50)
    expect(FREE_LIMITS.habits).toBe(3)
    expect(FREE_LIMITS.timelineWeeks).toBe(4)
  })
})
```

- [ ] **Step 2: 테스트 실행해서 실패 확인**

```bash
npx jest src/__tests__/lib/plan.test.ts
```

Expected: FAIL — `Cannot find module '@/lib/plan'`

- [ ] **Step 3: plan.ts 구현**

```typescript
// src/lib/plan.ts
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
```

- [ ] **Step 4: 테스트 통과 확인**

```bash
npx jest src/__tests__/lib/plan.test.ts
```

Expected: PASS (5 tests)

- [ ] **Step 5: Commit**

```bash
git add src/lib/plan.ts src/__tests__/lib/plan.test.ts
git commit -m "feat: add plan utility with free/pro limits"
```

---

## Task 3: Stripe 패키지 설치 및 환경변수 설정

**Files:**
- Modify: `.env.local` (직접 추가, git에 커밋하지 말 것)

- [ ] **Step 1: Stripe 설치**

```bash
npm install stripe @stripe/stripe-js
```

Expected: added stripe, @stripe/stripe-js to package.json

- [ ] **Step 2: .env.local에 환경변수 추가**

```
STRIPE_SECRET_KEY=sk_test_...        # Stripe 대시보드 → API Keys
STRIPE_WEBHOOK_SECRET=whsec_...      # Stripe 대시보드 → Webhooks
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_...
STRIPE_PRO_MONTHLY_PRICE_ID=price_... # Stripe 대시보드에서 생성한 $1/월 Price ID
STRIPE_PRO_YEARLY_PRICE_ID=price_...  # $8/년 Price ID
```

Stripe 대시보드에서 해야 할 일:
1. Products → Add product → "Personal Board Pro"
2. Pricing → $1.00 / month (recurring) → Price ID 복사
3. Pricing → $8.00 / year (recurring) → Price ID 복사
4. Webhooks → Add endpoint → `https://your-domain.com/api/stripe/webhook`
5. Events 선택: `customer.subscription.created`, `customer.subscription.updated`, `customer.subscription.deleted`, `invoice.payment_failed`

- [ ] **Step 3: Commit (env 파일 제외)**

```bash
git add package.json package-lock.json
git commit -m "feat: install stripe package"
```

---

## Task 4: Stripe Checkout API 라우트

**Files:**
- Create: `src/app/api/stripe/checkout/route.ts`

- [ ] **Step 1: checkout route 작성**

```typescript
// src/app/api/stripe/checkout/route.ts
import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!)

export async function POST(request: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { priceId } = await request.json()
  if (!priceId) {
    return NextResponse.json({ error: 'priceId required' }, { status: 400 })
  }

  const validPriceIds = [
    process.env.STRIPE_PRO_MONTHLY_PRICE_ID,
    process.env.STRIPE_PRO_YEARLY_PRICE_ID,
  ]
  if (!validPriceIds.includes(priceId)) {
    return NextResponse.json({ error: 'Invalid priceId' }, { status: 400 })
  }

  // 기존 Stripe customer ID 조회 또는 신규 생성
  const sub = await prisma.subscription.findUnique({
    where: { userId: session.user.id },
    select: { stripeCustomerId: true },
  })

  let customerId = sub?.stripeCustomerId
  if (!customerId) {
    const customer = await stripe.customers.create({
      email: session.user.email ?? undefined,
      metadata: { userId: session.user.id },
    })
    customerId = customer.id
    await prisma.subscription.upsert({
      where: { userId: session.user.id },
      create: { userId: session.user.id, stripeCustomerId: customerId },
      update: { stripeCustomerId: customerId },
    })
  }

  const origin = request.headers.get('origin') ?? 'http://localhost:3000'
  const checkoutSession = await stripe.checkout.sessions.create({
    customer: customerId,
    mode: 'subscription',
    line_items: [{ price: priceId, quantity: 1 }],
    success_url: `${origin}/?upgraded=true`,
    cancel_url: `${origin}/`,
    subscription_data: {
      metadata: { userId: session.user.id },
    },
  })

  return NextResponse.json({ url: checkoutSession.url })
}
```

- [ ] **Step 2: Commit**

```bash
git add src/app/api/stripe/checkout/route.ts
git commit -m "feat: add Stripe checkout session endpoint"
```

---

## Task 5: Stripe Webhook 처리

**Files:**
- Create: `src/app/api/stripe/webhook/route.ts`

- [ ] **Step 1: webhook route 작성**

```typescript
// src/app/api/stripe/webhook/route.ts
import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'
import { prisma } from '@/lib/prisma'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!)

export async function POST(request: NextRequest) {
  const body = await request.text()
  const sig = request.headers.get('stripe-signature')!

  let event: Stripe.Event
  try {
    event = stripe.webhooks.constructEvent(body, sig, process.env.STRIPE_WEBHOOK_SECRET!)
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
      const expiresAt = isActive
        ? new Date(sub.current_period_end * 1000)
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
```

- [ ] **Step 2: Commit**

```bash
git add src/app/api/stripe/webhook/route.ts
git commit -m "feat: handle Stripe subscription webhooks"
```

---

## Task 6: Stripe Customer Portal (구독 관리)

**Files:**
- Create: `src/app/api/stripe/portal/route.ts`

- [ ] **Step 1: portal route 작성**

```typescript
// src/app/api/stripe/portal/route.ts
import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!)

export async function POST(request: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const sub = await prisma.subscription.findUnique({
    where: { userId: session.user.id },
    select: { stripeCustomerId: true },
  })
  if (!sub?.stripeCustomerId) {
    return NextResponse.json({ error: 'No subscription found' }, { status: 404 })
  }

  const origin = request.headers.get('origin') ?? 'http://localhost:3000'
  const portalSession = await stripe.billingPortal.sessions.create({
    customer: sub.stripeCustomerId,
    return_url: `${origin}/`,
  })

  return NextResponse.json({ url: portalSession.url })
}
```

Stripe 대시보드에서 Customer Portal 활성화 필요: Settings → Billing → Customer portal → Activate

- [ ] **Step 2: Commit**

```bash
git add src/app/api/stripe/portal/route.ts
git commit -m "feat: add Stripe customer portal endpoint"
```

---

## Task 7: 현재 플랜 조회 API

**Files:**
- Create: `src/app/api/subscription/route.ts`

- [ ] **Step 1: subscription route 작성**

```typescript
// src/app/api/subscription/route.ts
import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { getUserPlan } from '@/lib/plan'

export async function GET() {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const plan = await getUserPlan(session.user.id)
  return NextResponse.json({ plan })
}
```

- [ ] **Step 2: Commit**

```bash
git add src/app/api/subscription/route.ts
git commit -m "feat: add subscription status endpoint"
```

---

## Task 8: RevenueCat Webhook (모바일 인앱결제)

**Files:**
- Create: `src/app/api/revenuecat/webhook/route.ts`

- [ ] **Step 1: .env.local에 RevenueCat 시크릿 추가**

```
REVENUECAT_WEBHOOK_AUTH_KEY=your_revenuecat_webhook_auth_header_value
```

RevenueCat 대시보드 → Project → Integrations → Webhooks → Authorization header 값

- [ ] **Step 2: webhook route 작성**

```typescript
// src/app/api/revenuecat/webhook/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function POST(request: NextRequest) {
  const authHeader = request.headers.get('authorization')
  if (authHeader !== process.env.REVENUECAT_WEBHOOK_AUTH_KEY) {
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
```

- [ ] **Step 3: Commit**

```bash
git add src/app/api/revenuecat/webhook/route.ts
git commit -m "feat: handle RevenueCat mobile subscription webhooks"
```

---

## Task 9: API 게이팅 — projects, habits, notes

**Files:**
- Modify: `src/app/api/projects/route.ts`
- Modify: `src/app/api/habits/route.ts`
- Modify: `src/app/api/notes/route.ts`

- [ ] **Step 1: projects POST에 한도 게이팅 추가**

`src/app/api/projects/route.ts`의 POST 함수 안에서 `if (!name)` 블록 바로 아래에 추가:

```typescript
import { getUserPlan, FREE_LIMITS } from '@/lib/plan'
```

파일 상단 import에 추가 후, POST 함수의 name 검사 아래 삽입:

```typescript
    const plan = await getUserPlan(session.user.id)
    if (plan === 'free') {
      const count = await prisma.project.count({ where: { userId: session.user.id } })
      if (count >= FREE_LIMITS.projects) {
        return NextResponse.json(
          { error: 'Free plan limit reached', code: 'UPGRADE_REQUIRED' },
          { status: 402 }
        )
      }
    }
```

- [ ] **Step 2: habits POST에 한도 게이팅 추가**

`src/app/api/habits/route.ts`의 POST 함수에서 name 검사 아래 삽입:

```typescript
import { getUserPlan, FREE_LIMITS } from '@/lib/plan'
```

```typescript
    const plan = await getUserPlan(session.user.id)
    if (plan === 'free') {
      const count = await prisma.habit.count({ where: { userId: session.user.id } })
      if (count >= FREE_LIMITS.habits) {
        return NextResponse.json(
          { error: 'Free plan limit reached', code: 'UPGRADE_REQUIRED' },
          { status: 402 }
        )
      }
    }
```

- [ ] **Step 3: notes POST에 한도 게이팅 추가**

`src/app/api/notes/route.ts`의 POST 함수에서 session 체크 직후 삽입:

```typescript
import { getUserPlan, FREE_LIMITS } from '@/lib/plan'
```

```typescript
    const plan = await getUserPlan(session.user.id)
    if (plan === 'free') {
      const count = await prisma.note.count({ where: { userId: session.user.id } })
      if (count >= FREE_LIMITS.notes) {
        return NextResponse.json(
          { error: 'Free plan limit reached', code: 'UPGRADE_REQUIRED' },
          { status: 402 }
        )
      }
    }
```

- [ ] **Step 4: Commit**

```bash
git add src/app/api/projects/route.ts src/app/api/habits/route.ts src/app/api/notes/route.ts
git commit -m "feat: gate projects/habits/notes creation by free plan limits"
```

---

## Task 10: API 게이팅 — timeline 히스토리

**Files:**
- Modify: `src/app/api/timeline/route.ts`

- [ ] **Step 1: timeline route.ts 확인 후 GET에 날짜 제한 추가**

```bash
cat src/app/api/timeline/route.ts
```

GET 핸들러에서 쿼리 파라미터로 날짜를 받는 부분을 확인 후, session 체크 직후 삽입:

```typescript
import { getUserPlan, FREE_LIMITS } from '@/lib/plan'
import { subWeeks, parseISO } from 'date-fns'
```

```typescript
    const plan = await getUserPlan(session.user.id)
    if (plan === 'free') {
      const requestedDate = searchParams.get('date')
      if (requestedDate) {
        const cutoff = subWeeks(new Date(), FREE_LIMITS.timelineWeeks)
        if (parseISO(requestedDate) < cutoff) {
          return NextResponse.json(
            { error: 'Free plan: history limited to 4 weeks', code: 'UPGRADE_REQUIRED' },
            { status: 402 }
          )
        }
      }
    }
```

- [ ] **Step 2: Commit**

```bash
git add src/app/api/timeline/route.ts
git commit -m "feat: limit timeline history to 4 weeks for free plan"
```

---

## Task 11: API 게이팅 — AI, Google Calendar, Vault

**Files:**
- Modify: `src/app/api/ai/feedback/route.ts`
- Modify: `src/app/api/ai/daily-brief/route.ts`
- Modify: `src/app/api/ai/project/route.ts`
- Modify: `src/app/api/google-calendar/route.ts`
- Modify: `src/app/api/vault/route.ts` (있는 경우)

- [ ] **Step 1: 각 파일에 assertPro 추가**

각 파일의 session 체크 바로 아래에 동일 패턴 삽입:

```typescript
import { assertPro } from '@/lib/plan'
```

```typescript
    const upgradeRes = await assertPro(session.user.id)
    if (upgradeRes) return upgradeRes
```

적용 파일 목록:
- `src/app/api/ai/feedback/route.ts` — GET 핸들러
- `src/app/api/ai/daily-brief/route.ts` — GET 핸들러
- `src/app/api/ai/project/route.ts` — GET 핸들러
- `src/app/api/google-calendar/route.ts` — GET 핸들러
- `src/app/api/vault/route.ts` — 모든 핸들러 (파일 존재 여부 확인 후)

- [ ] **Step 2: Commit**

```bash
git add src/app/api/ai/ src/app/api/google-calendar/route.ts src/app/api/vault/
git commit -m "feat: gate AI, Google Calendar, Vault to pro plan"
```

---

## Task 12: UpgradeModal 컴포넌트

**Files:**
- Create: `src/components/UpgradeModal.tsx`

- [ ] **Step 1: UpgradeModal 작성**

```typescript
// src/components/UpgradeModal.tsx
'use client'
import { useState } from 'react'

interface Props {
  open: boolean
  onClose: () => void
  reason?: string // 표시할 한도 초과 메시지
}

const MONTHLY_PRICE_ID = process.env.NEXT_PUBLIC_STRIPE_PRO_MONTHLY_PRICE_ID!
const YEARLY_PRICE_ID = process.env.NEXT_PUBLIC_STRIPE_PRO_YEARLY_PRICE_ID!

export default function UpgradeModal({ open, onClose, reason }: Props) {
  const [loading, setLoading] = useState(false)
  const [billingPeriod, setBillingPeriod] = useState<'monthly' | 'yearly'>('yearly')

  if (!open) return null

  const handleUpgrade = async () => {
    setLoading(true)
    const priceId = billingPeriod === 'yearly' ? YEARLY_PRICE_ID : MONTHLY_PRICE_ID
    const res = await fetch('/api/stripe/checkout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ priceId }),
    })
    const data = await res.json()
    if (data.url) window.location.href = data.url
    else setLoading(false)
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
      onClick={onClose}
    >
      <div
        className="bg-[var(--bg-card)] rounded-2xl p-6 w-full max-w-sm mx-4 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-lg font-semibold mb-1">Pro로 업그레이드</h2>
        <p className="text-sm text-[var(--text-secondary)] mb-4">
          {reason ?? '더 많은 데이터와 AI 기능을 사용하려면 Pro가 필요합니다.'}
        </p>

        <div className="flex rounded-lg overflow-hidden border border-[var(--border)] mb-4">
          <button
            className={`flex-1 py-2 text-sm font-medium transition-colors ${
              billingPeriod === 'yearly'
                ? 'bg-indigo-600 text-white'
                : 'text-[var(--text-secondary)]'
            }`}
            onClick={() => setBillingPeriod('yearly')}
          >
            연결제 $8/년
            <span className="ml-1 text-xs opacity-75">33% 절약</span>
          </button>
          <button
            className={`flex-1 py-2 text-sm font-medium transition-colors ${
              billingPeriod === 'monthly'
                ? 'bg-indigo-600 text-white'
                : 'text-[var(--text-secondary)]'
            }`}
            onClick={() => setBillingPeriod('monthly')}
          >
            월결제 $1/월
          </button>
        </div>

        <ul className="text-sm text-[var(--text-secondary)] space-y-1 mb-5">
          <li>✓ 프로젝트 / 메모 / 습관 무제한</li>
          <li>✓ 타임라인 전체 히스토리</li>
          <li>✓ AI 일일 브리핑 · 주간 회고 · 프로젝트 진단</li>
          <li>✓ Google Calendar 연동</li>
          <li>✓ 금고 (암호화 저장)</li>
        </ul>

        <button
          onClick={handleUpgrade}
          disabled={loading}
          className="w-full py-2.5 rounded-lg bg-indigo-600 text-white font-medium text-sm disabled:opacity-60"
        >
          {loading ? '리디렉션 중...' : '업그레이드 시작'}
        </button>
        <button
          onClick={onClose}
          className="w-full mt-2 py-2 text-sm text-[var(--text-secondary)]"
        >
          나중에
        </button>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: .env.local에 클라이언트 환경변수 추가**

```
NEXT_PUBLIC_STRIPE_PRO_MONTHLY_PRICE_ID=price_...
NEXT_PUBLIC_STRIPE_PRO_YEARLY_PRICE_ID=price_...
```

- [ ] **Step 3: Commit**

```bash
git add src/components/UpgradeModal.tsx
git commit -m "feat: add UpgradeModal component with Stripe checkout"
```

---

## Task 13: 프론트엔드 — 402 공통 처리 훅

**Files:**
- Create: `src/hooks/useUpgradeModal.ts`

API fetch가 402를 반환할 때 어디서든 모달을 띄울 수 있는 전역 상태 훅.

- [ ] **Step 1: useUpgradeModal 훅 작성**

```typescript
// src/hooks/useUpgradeModal.ts
'use client'
import { useState, useCallback } from 'react'

export function useUpgradeModal() {
  const [open, setOpen] = useState(false)
  const [reason, setReason] = useState<string | undefined>()

  const triggerUpgrade = useCallback((msg?: string) => {
    setReason(msg)
    setOpen(true)
  }, [])

  const closeUpgrade = useCallback(() => setOpen(false), [])

  return { upgradeOpen: open, upgradeReason: reason, triggerUpgrade, closeUpgrade }
}

// 402 응답 확인 유틸
export function isUpgradeRequired(status: number): boolean {
  return status === 402
}
```

- [ ] **Step 2: Commit**

```bash
git add src/hooks/useUpgradeModal.ts
git commit -m "feat: add useUpgradeModal hook for 402 handling"
```

---

## Task 14: SettingsModal에 Billing 탭 추가

**Files:**
- Modify: `src/components/SettingsModal.tsx`

- [ ] **Step 1: SettingsModal.tsx 읽기**

```bash
cat src/components/SettingsModal.tsx
```

기존 탭 구조를 확인 후, Billing 탭을 추가한다.

- [ ] **Step 2: Billing 탭 내용 추가**

기존 탭 목록에 "Billing" 추가. 탭 컨텐츠 영역에 아래 컴포넌트 추가:

```typescript
// SettingsModal.tsx 내 Billing 탭 컴포넌트 (함수 내 인라인 또는 분리 정의)
function BillingTab() {
  const [plan, setPlan] = useState<'free' | 'pro' | null>(null)
  const [portalLoading, setPortalLoading] = useState(false)
  const { upgradeOpen, upgradeReason, triggerUpgrade, closeUpgrade } = useUpgradeModal()

  useEffect(() => {
    fetch('/api/subscription')
      .then((r) => r.json())
      .then((d) => setPlan(d.plan))
  }, [])

  const openPortal = async () => {
    setPortalLoading(true)
    const res = await fetch('/api/stripe/portal', { method: 'POST' })
    const data = await res.json()
    if (data.url) window.location.href = data.url
    else setPortalLoading(false)
  }

  if (!plan) return <div className="animate-pulse h-20 rounded bg-[var(--border)]" />

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between p-4 rounded-xl border border-[var(--border)]">
        <div>
          <p className="font-medium">{plan === 'pro' ? 'Pro 플랜' : 'Free 플랜'}</p>
          <p className="text-sm text-[var(--text-secondary)]">
            {plan === 'pro' ? 'AI, 무제한 데이터 사용 중' : '기본 기능 사용 중'}
          </p>
        </div>
        {plan === 'pro' ? (
          <button
            onClick={openPortal}
            disabled={portalLoading}
            className="text-sm px-3 py-1.5 rounded-lg border border-[var(--border)] disabled:opacity-60"
          >
            {portalLoading ? '...' : '구독 관리'}
          </button>
        ) : (
          <button
            onClick={() => triggerUpgrade()}
            className="text-sm px-3 py-1.5 rounded-lg bg-indigo-600 text-white"
          >
            업그레이드
          </button>
        )}
      </div>
      <UpgradeModal open={upgradeOpen} onClose={closeUpgrade} reason={upgradeReason} />
    </div>
  )
}
```

필요한 import 추가:
```typescript
import { useState, useEffect } from 'react'
import UpgradeModal from './UpgradeModal'
import { useUpgradeModal } from '@/hooks/useUpgradeModal'
```

- [ ] **Step 3: Commit**

```bash
git add src/components/SettingsModal.tsx
git commit -m "feat: add Billing tab to SettingsModal"
```

---

## Task 15: 잠금 기능 인라인 UX (AI, Vault, Calendar)

**Files:**
- Modify: `src/components/AIPanel.tsx`

- [ ] **Step 1: AIPanel에서 402 수신 시 업그레이드 모달 트리거**

AIPanel.tsx 내 AI API 호출 부분(fetch)에서 응답 status 체크 추가:

```typescript
import UpgradeModal from './UpgradeModal'
import { useUpgradeModal } from '@/hooks/useUpgradeModal'
```

AI fetch 실패 처리 부분:

```typescript
const { upgradeOpen, upgradeReason, triggerUpgrade, closeUpgrade } = useUpgradeModal()

// 기존 fetch 호출 후 응답 처리에 추가
if (res.status === 402) {
  triggerUpgrade('AI 기능은 Pro 플랜에서 사용할 수 있습니다.')
  return
}
```

JSX 반환부 최상위 fragment에 추가:

```tsx
<UpgradeModal open={upgradeOpen} onClose={closeUpgrade} reason={upgradeReason} />
```

- [ ] **Step 2: Commit**

```bash
git add src/components/AIPanel.tsx
git commit -m "feat: show upgrade modal when AI returns 402"
```

---

## Task 16: 로컬 테스트

- [ ] **Step 1: 개발 서버 실행**

```bash
npm run dev
```

- [ ] **Step 2: Stripe CLI로 webhook 로컬 포워딩**

별도 터미널에서:

```bash
stripe listen --forward-to localhost:3000/api/stripe/webhook
```

출력된 `whsec_...` 값을 `.env.local`의 `STRIPE_WEBHOOK_SECRET`에 업데이트 후 서버 재시작.

- [ ] **Step 3: 테스트 시나리오 실행**

1. Free 계정으로 로그인
2. 프로젝트 3개 생성 → 4번째 생성 시도 → UpgradeModal 표시 확인
3. UpgradeModal → 연결제 선택 → Stripe 테스트 카드(`4242 4242 4242 4242`) 결제
4. `success_url`로 리디렉션 확인
5. SettingsModal → Billing 탭 → "Pro 플랜" 표시 확인
6. AI 패널 사용 가능 확인

- [ ] **Step 4: 전체 테스트 실행**

```bash
npx jest
```

Expected: All tests pass

- [ ] **Step 5: 최종 Commit**

```bash
git add -A
git commit -m "chore: finalize monetization implementation"
```
