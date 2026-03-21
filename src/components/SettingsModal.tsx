'use client'

import { useEffect, useState } from 'react'
import { useSession, signOut, signIn } from 'next-auth/react'
import Image from 'next/image'
import { X, LogOut, Calendar, Sun, Moon } from 'lucide-react'

const CALENDAR_SCOPE = 'openid email profile https://www.googleapis.com/auth/calendar.readonly'

interface SettingsModalProps {
  isOpen: boolean
  onClose: () => void
}

type CalStatus = 'loading' | 'ok' | 'no_token' | 'error'

export default function SettingsModal({ isOpen, onClose }: SettingsModalProps) {
  const { data: session } = useSession()
  const [calStatus, setCalStatus] = useState<CalStatus>('loading')
  const [defaultView, setDefaultView] = useState<'weekly' | 'monthly'>('weekly')
  const [weekStart, setWeekStart] = useState<'mon' | 'sun'>('mon')
  const [theme, setTheme] = useState<'dark' | 'light'>('dark')

  useEffect(() => {
    if (!isOpen) return
    // localStorage 읽기
    const view = localStorage.getItem('default-view')
    if (view === 'weekly' || view === 'monthly') setDefaultView(view)
    const ws = localStorage.getItem('week-start')
    if (ws === 'mon' || ws === 'sun') setWeekStart(ws)
    const t = localStorage.getItem('theme')
    setTheme(t === 'light' ? 'light' : 'dark')
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

  if (!isOpen) return null

  const user = session?.user

  return (
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

        <div className="px-5 pb-2">

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

        </div>
      </div>
    </div>
  )
}
