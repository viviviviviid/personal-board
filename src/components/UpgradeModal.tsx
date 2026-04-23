'use client'
import { useState } from 'react'
import { useScrollLock } from '@/hooks/useScrollLock'

interface Props {
  open: boolean
  onClose: () => void
  reason?: string
}

const MONTHLY_PRICE_ID = process.env.NEXT_PUBLIC_STRIPE_PRO_MONTHLY_PRICE_ID!
const YEARLY_PRICE_ID = process.env.NEXT_PUBLIC_STRIPE_PRO_YEARLY_PRICE_ID!

export default function UpgradeModal({ open, onClose, reason }: Props) {
  const [loading, setLoading] = useState(false)
  const [billingPeriod, setBillingPeriod] = useState<'monthly' | 'yearly'>('yearly')

  useScrollLock(open)

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
