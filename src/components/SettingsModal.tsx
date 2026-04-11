'use client'

import { useEffect, useState } from 'react'
import { useSession, signOut, signIn } from 'next-auth/react'
import Image from 'next/image'
import { X, LogOut, Calendar, Sun, Moon } from 'lucide-react'
import UpgradeModal from '@/components/UpgradeModal'
import { useUpgradeModal } from '@/hooks/useUpgradeModal'

const CALENDAR_SCOPE = 'openid email profile https://www.googleapis.com/auth/calendar.readonly'

interface SettingsModalProps {
  isOpen: boolean
  onClose: () => void
}

type CalStatus = 'loading' | 'ok' | 'no_token' | 'error'
type SettingsTab = 'general' | 'billing'

type PlanInfo = { plan: string } | null

function BillingTab({ onOpenUpgrade }: { onOpenUpgrade: (msg?: string) => void }) {
  const [planInfo, setPlanInfo] = useState<PlanInfo>(null)
  const [planLoading, setPlanLoading] = useState(true)
  const [portalLoading, setPortalLoading] = useState(false)

  useEffect(() => {
    setPlanLoading(true)
    fetch('/api/subscription')
      .then(r => r.ok ? r.json() : Promise.reject())
      .then(data => setPlanInfo(data))
      .catch(() => setPlanInfo({ plan: 'free' }))
      .finally(() => setPlanLoading(false))
  }, [])

  const handlePortal = async () => {
    setPortalLoading(true)
    const res = await fetch('/api/stripe/portal', { method: 'POST' })
    const data = await res.json()
    if (data.url) window.location.href = data.url
    else setPortalLoading(false)
  }

  const isPro = planInfo?.plan === 'pro'

  return (
    <div
      className="rounded-xl overflow-hidden"
      style={{ border: '1px solid var(--border)' }}
    >
      <div className="px-4 py-3" style={{ background: 'var(--bg-card)' }}>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium" style={{ color: 'var(--text)' }}>현재 플랜</p>
            {planLoading ? (
              <div className="mt-1 h-4 w-16 rounded animate-pulse" style={{ background: 'var(--border)' }} />
            ) : (
              <p className="text-xs mt-0.5" style={{ color: 'var(--text-dim)' }}>
                {isPro ? 'Pro' : 'Free'}
              </p>
            )}
          </div>
          {!planLoading && (
            isPro ? (
              <span
                className="text-xs px-2 py-0.5 rounded-full"
                style={{ background: 'rgba(99,102,241,0.15)', color: '#818cf8', border: '1px solid rgba(99,102,241,0.3)' }}
              >
                Pro
              </span>
            ) : (
              <span
                className="text-xs px-2 py-0.5 rounded-full"
                style={{ background: 'var(--bg-input)', color: 'var(--text-dim)', border: '1px solid var(--border)' }}
              >
                Free
              </span>
            )
          )}
        </div>

        {!planLoading && (
          <button
            onClick={isPro ? handlePortal : () => onOpenUpgrade()}
            disabled={portalLoading}
            className="mt-3 text-sm w-full text-center py-2 rounded-lg transition-all font-medium disabled:opacity-60"
            style={
              isPro
                ? { background: 'var(--bg-input)', color: 'var(--text-muted)', border: '1px solid var(--border)' }
                : { background: 'var(--accent-dim)', color: 'var(--accent-light)', border: '1px solid var(--accent)' }
            }
          >
            {portalLoading ? '로딩 중...' : isPro ? '구독 관리' : '업그레이드'}
          </button>
        )}
      </div>
    </div>
  )
}

export default function SettingsModal({ isOpen, onClose }: SettingsModalProps) {
  const { data: session } = useSession()
  const [activeTab, setActiveTab] = useState<SettingsTab>('general')
  const [calStatus, setCalStatus] = useState<CalStatus>('loading')
  const [defaultView, setDefaultView] = useState<'weekly' | 'monthly'>('weekly')
  const [weekStart, setWeekStart] = useState<'mon' | 'sun'>('mon')
  const [theme, setTheme] = useState<'dark' | 'light'>('dark')
  const [autoFeedback, setAutoFeedback] = useState(false)
  const [feedbackDataTypes, setFeedbackDataTypes] = useState<string[]>(['todos', 'timeline', 'habits', 'highlights'])
  const { upgradeOpen, upgradeReason, triggerUpgrade, closeUpgrade } = useUpgradeModal()

  useEffect(() => {
    if (!isOpen) return
    // localStorage 읽기
    const view = localStorage.getItem('default-view')
    if (view === 'weekly' || view === 'monthly') setDefaultView(view)
    const ws = localStorage.getItem('week-start')
    if (ws === 'mon' || ws === 'sun') setWeekStart(ws)
    const t = localStorage.getItem('theme')
    setTheme(t === 'light' ? 'light' : 'dark')
    setAutoFeedback(localStorage.getItem('ai-auto-feedback') === 'true')
    const stored = localStorage.getItem('ai-feedback-data-types')
    if (stored) setFeedbackDataTypes(JSON.parse(stored))
    // 캘린더 상태 확인
    setCalStatus('loading')
    fetch('/api/google-calendar/list')
      .then(r => r.ok ? r.json() : Promise.reject())
      .then(data => setCalStatus(data.status === 'no_token' ? 'no_token' : 'ok'))
      .catch(() => setCalStatus('error'))
  }, [isOpen])

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
    return () => { document.body.style.overflow = '' }
  }, [isOpen])

  const setView = (v: 'weekly' | 'monthly') => {
    setDefaultView(v)
    localStorage.setItem('default-view', v)
  }

  const setWeekStartDay = (v: 'mon' | 'sun') => {
    setWeekStart(v)
    localStorage.setItem('week-start', v)
  }

  const toggleTheme = () => {
    const next = theme === 'dark' ? 'light' : 'dark'
    setTheme(next)
    localStorage.setItem('theme', next)
    document.documentElement.setAttribute('data-theme', next)
  }

  const handleAutoFeedbackToggle = () => {
    const next = !autoFeedback
    setAutoFeedback(next)
    localStorage.setItem('ai-auto-feedback', next ? 'true' : 'false')
  }

  const handleDataTypeToggle = (type: string) => {
    const next = feedbackDataTypes.includes(type)
      ? feedbackDataTypes.filter(t => t !== type)
      : [...feedbackDataTypes, type]
    setFeedbackDataTypes(next)
    localStorage.setItem('ai-feedback-data-types', JSON.stringify(next))
  }

  if (!isOpen) return null

  const user = session?.user

  return (
    <>
    <div
      className="fixed inset-0 z-50 flex items-end md:items-center justify-center"
      style={{ background: 'rgba(0,0,0,0.6)' }}
      onClick={onClose}
    >
      <div
        className="w-full md:max-w-md rounded-t-2xl md:rounded-2xl settings-slide-up"
        style={{
          background: 'var(--bg-surface)',
          border: '1px solid var(--border)',
          maxHeight: '90vh',
          overflowY: 'auto',
          paddingBottom: 'calc(env(safe-area-inset-bottom) + 16px)',
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* 핸들 + 닫기 */}
        <div className="flex items-center justify-between px-5 pt-4 pb-2">
          <div className="w-8 h-1 rounded-full mx-auto md:hidden" style={{ background: 'var(--border)' }} />
          <div className="hidden md:block" />
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg transition-all ml-auto"
            style={{ color: 'var(--text-dim)', background: 'var(--bg-card)' }}
          >
            <X size={16} />
          </button>
        </div>

        {/* ── 탭 ── */}
        <div className="flex px-5 gap-1 mb-1" style={{ borderBottom: '1px solid var(--border-dim)' }}>
          {(['general', 'billing'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className="px-3 py-2 text-xs transition-all mb-[-1px]"
              style={{
                color: activeTab === tab ? 'var(--accent-light)' : 'var(--text-muted)',
                borderBottom: activeTab === tab ? '2px solid var(--accent)' : '2px solid transparent',
                fontWeight: activeTab === tab ? 600 : 400,
              }}
            >
              {tab === 'general' ? '일반' : '빌링'}
            </button>
          ))}
        </div>

        <div className="px-5 pb-2">

          {activeTab === 'billing' && (
            <>
              <div className="my-4" />
              <p className="text-[10px] font-semibold tracking-widest uppercase mb-3" style={{ color: 'var(--text-dim)' }}>빌링</p>
              <BillingTab onOpenUpgrade={triggerUpgrade} />
            </>
          )}

          {activeTab === 'general' && (
          <>
          {/* ── 계정 ── */}
          <p className="text-[10px] font-semibold tracking-widest uppercase mb-3" style={{ color: 'var(--text-dim)' }}>계정</p>
          {user ? (
            <div className="flex items-center gap-3 mb-1">
              {user.image ? (
                <Image src={user.image} alt={user.name ?? ''} width={44} height={44} className="rounded-full flex-shrink-0" />
              ) : (
                <div
                  className="w-11 h-11 rounded-full flex items-center justify-center text-base font-bold flex-shrink-0"
                  style={{ background: 'var(--accent-dim)', color: 'var(--accent-light)' }}
                >
                  {user.name?.[0] ?? '?'}
                </div>
              )}
              <div className="min-w-0">
                <p className="font-semibold truncate" style={{ color: 'var(--text-bright)' }}>{user.name}</p>
                <p className="text-xs truncate" style={{ color: 'var(--text-muted)' }}>{user.email}</p>
              </div>
            </div>
          ) : (
            <p className="text-sm mb-1" style={{ color: 'var(--text-dim)' }}>로그인 정보 없음</p>
          )}

          {/* ── 구분선 ── */}
          <div className="my-5" style={{ borderTop: '1px solid var(--border-dim)' }} />

          {/* ── Google Calendar ── */}
          <p className="text-[10px] font-semibold tracking-widest uppercase mb-3" style={{ color: 'var(--text-dim)' }}>Google Calendar</p>
          <div
            className="rounded-xl p-4"
            style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Calendar size={16} style={{ color: 'var(--text-muted)' }} />
                <span className="text-sm" style={{ color: 'var(--text)' }}>Google Calendar</span>
              </div>
              {calStatus === 'loading' && (
                <span className="text-xs" style={{ color: 'var(--text-dim)' }}>확인 중...</span>
              )}
              {calStatus === 'ok' && (
                <span
                  className="text-xs px-2 py-0.5 rounded-full"
                  style={{ background: 'rgba(16,185,129,0.12)', color: '#34d399', border: '1px solid rgba(16,185,129,0.25)' }}
                >
                  연결됨
                </span>
              )}
              {(calStatus === 'no_token' || calStatus === 'error') && (
                <span
                  className="text-xs px-2 py-0.5 rounded-full"
                  style={{ background: 'var(--bg-input)', color: 'var(--text-dim)', border: '1px solid var(--border)' }}
                >
                  미연결
                </span>
              )}
            </div>
            {calStatus === 'ok' && (
              <button
                onClick={() => signIn('google', { callbackUrl: '/' }, { scope: CALENDAR_SCOPE, access_type: 'offline', prompt: 'consent' })}
                className="mt-3 text-xs w-full text-center py-1.5 rounded-lg transition-all"
                style={{ background: 'var(--bg-input)', color: 'var(--text-muted)', border: '1px solid var(--border)' }}
              >
                재연결
              </button>
            )}
            {(calStatus === 'no_token' || calStatus === 'error') && (
              <button
                onClick={() => signIn('google', { callbackUrl: '/' }, { scope: CALENDAR_SCOPE, access_type: 'offline', prompt: 'consent' })}
                className="mt-3 text-sm w-full text-center py-2 rounded-lg transition-all font-medium"
                style={{ background: 'var(--accent-dim)', color: 'var(--accent-light)', border: '1px solid var(--accent)' }}
              >
                연결하기
              </button>
            )}
          </div>

          {/* ── 구분선 ── */}
          <div className="my-5" style={{ borderTop: '1px solid var(--border-dim)' }} />

          {/* ── 앱 설정 ── */}
          <p className="text-[10px] font-semibold tracking-widest uppercase mb-3" style={{ color: 'var(--text-dim)' }}>앱 설정</p>
          <div
            className="rounded-xl overflow-hidden"
            style={{ border: '1px solid var(--border)' }}
          >
            {/* 기본 뷰 */}
            <div className="flex items-center justify-between px-4 py-3" style={{ background: 'var(--bg-card)' }}>
              <span className="text-sm" style={{ color: 'var(--text)' }}>기본 뷰</span>
              <div className="flex rounded-lg overflow-hidden" style={{ border: '1px solid var(--border)' }}>
                {(['weekly', 'monthly'] as const).map((v, i) => (
                  <button
                    key={v}
                    onClick={() => setView(v)}
                    className="px-3 py-1.5 text-xs transition-all"
                    style={{
                      background: defaultView === v ? 'var(--accent-dim)' : 'var(--bg-input)',
                      color: defaultView === v ? 'var(--accent-light)' : 'var(--text-muted)',
                      borderRight: i === 0 ? '1px solid var(--border)' : 'none',
                    }}
                  >
                    {v === 'weekly' ? '주간' : '월간'}
                  </button>
                ))}
              </div>
            </div>
            <div style={{ borderTop: '1px solid var(--border-dim)' }} />
            {/* 테마 */}
            <div className="flex items-center justify-between px-4 py-3" style={{ background: 'var(--bg-card)' }}>
              <span className="text-sm" style={{ color: 'var(--text)' }}>테마</span>
              <button
                onClick={toggleTheme}
                className="flex items-center gap-2 px-3 py-1.5 rounded-lg transition-all text-xs"
                style={{ background: 'var(--bg-input)', border: '1px solid var(--border)', color: 'var(--text-muted)' }}
              >
                {theme === 'dark' ? <Moon size={13} /> : <Sun size={13} />}
                {theme === 'dark' ? '다크' : '라이트'}
              </button>
            </div>
            <div style={{ borderTop: '1px solid var(--border-dim)' }} />
            {/* 주 시작 */}
            <div className="flex items-center justify-between px-4 py-3" style={{ background: 'var(--bg-card)' }}>
              <span className="text-sm" style={{ color: 'var(--text)' }}>주 시작</span>
              <div className="flex rounded-lg overflow-hidden" style={{ border: '1px solid var(--border)' }}>
                {(['mon', 'sun'] as const).map((v, i) => (
                  <button
                    key={v}
                    onClick={() => setWeekStartDay(v)}
                    className="px-3 py-1.5 text-xs transition-all"
                    style={{
                      background: weekStart === v ? 'var(--accent-dim)' : 'var(--bg-input)',
                      color: weekStart === v ? 'var(--accent-light)' : 'var(--text-muted)',
                      borderRight: i === 0 ? '1px solid var(--border)' : 'none',
                    }}
                  >
                    {v === 'mon' ? '월요일' : '일요일'}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* ── 구분선 ── */}
          <div className="my-5" style={{ borderTop: '1px solid var(--border-dim)' }} />

          {/* ── AI 피드백 ── */}
          <p className="text-[10px] font-semibold tracking-widest uppercase mb-3" style={{ color: 'var(--text-dim)' }}>AI 피드백</p>
          <div
            className="rounded-xl overflow-hidden"
            style={{ border: '1px solid var(--border)' }}
          >
            {/* 자동 피드백 토글 */}
            <div className="px-4 py-3" style={{ background: 'var(--bg-card)' }}>
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-sm" style={{ color: 'var(--text)' }}>자동 피드백</span>
                  <p className="text-xs mt-0.5" style={{ color: 'var(--text-dim)' }}>오늘 처음 방문 시 지난 7일 피드백을 자동 생성합니다</p>
                </div>
                <button
                  onClick={handleAutoFeedbackToggle}
                  className="relative flex-shrink-0 w-10 h-5 rounded-full transition-colors"
                  style={{
                    background: autoFeedback ? 'var(--accent)' : 'var(--bg-input)',
                    border: '1px solid var(--border)',
                  }}
                >
                  <span
                    className="absolute top-0.5 w-4 h-4 rounded-full transition-transform"
                    style={{
                      background: autoFeedback ? '#fff' : 'var(--text-dim)',
                      left: autoFeedback ? '20px' : '2px',
                    }}
                  />
                </button>
              </div>
            </div>

            {/* 포함할 데이터 (자동 피드백 활성화 시만 표시) */}
            {autoFeedback && (
              <>
                <div style={{ borderTop: '1px solid var(--border-dim)' }} />
                <div className="px-4 py-3" style={{ background: 'var(--bg-card)' }}>
                  <p className="text-xs mb-2 font-medium" style={{ color: 'var(--text-muted)' }}>포함할 데이터:</p>
                  <div className="flex flex-col gap-2">
                    {[
                      { key: 'todos', label: '투두' },
                      { key: 'timeline', label: '타임라인' },
                      { key: 'habits', label: '습관' },
                      { key: 'highlights', label: '데일리 하이라이트' },
                    ].map(({ key, label }) => (
                      <label key={key} className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={feedbackDataTypes.includes(key)}
                          onChange={() => handleDataTypeToggle(key)}
                          className="w-3.5 h-3.5 rounded"
                          style={{ accentColor: 'var(--accent)' }}
                        />
                        <span className="text-sm" style={{ color: 'var(--text)' }}>{label}</span>
                      </label>
                    ))}
                  </div>
                </div>
              </>
            )}
          </div>

          {/* ── 로그아웃 ── */}
          <button
            onClick={() => signOut({ callbackUrl: '/login' })}
            className="mt-6 w-full flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-medium transition-all"
            style={{
              background: 'rgba(239,68,68,0.08)',
              border: '1px solid rgba(239,68,68,0.2)',
              color: '#ef4444',
            }}
          >
            <LogOut size={15} />
            로그아웃
          </button>
          </>
          )}

        </div>
      </div>
    </div>

    <UpgradeModal open={upgradeOpen} onClose={closeUpgrade} reason={upgradeReason} />
    </>
  )
}
