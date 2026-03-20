'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { format } from 'date-fns'
import { Timer, Play, Pause, RotateCcw, X } from 'lucide-react'

const FOCUS_SEC = 25 * 60
const BREAK_SEC = 5 * 60

type Phase = 'idle' | 'focus' | 'break'

function todayKey() {
  return `pomodoro-${format(new Date(), 'yyyy-MM-dd')}`
}

export default function PomodoroTimer() {
  const [phase, setPhase] = useState<Phase>('idle')
  const [remaining, setRemaining] = useState(FOCUS_SEC)
  const [sessions, setSessions] = useState(0)
  const [open, setOpen] = useState(false)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // localStorage에서 오늘 세션 수 복원
  useEffect(() => {
    const saved = localStorage.getItem(todayKey())
    if (saved) setSessions(Number(saved))
  }, [])

  const persistSessions = (n: number) => {
    setSessions(n)
    localStorage.setItem(todayKey(), String(n))
  }

  const stop = useCallback(() => {
    if (intervalRef.current) clearInterval(intervalRef.current)
    intervalRef.current = null
  }, [])

  const tick = useCallback(() => {
    setRemaining(prev => {
      if (prev <= 1) {
        stop()
        setPhase(p => {
          if (p === 'focus') {
            setSessions(s => {
              const next = s + 1
              localStorage.setItem(todayKey(), String(next))
              return next
            })
            // 브라우저 알림
            if (typeof window !== 'undefined' && Notification.permission === 'granted') {
              new Notification('집중 완료! 🍅', { body: '5분 휴식을 취하세요.' })
            }
            setTimeout(() => {
              setRemaining(BREAK_SEC)
              setPhase('break')
            }, 0)
          } else {
            if (typeof window !== 'undefined' && Notification.permission === 'granted') {
              new Notification('휴식 종료!', { body: '다음 집중 세션을 시작하세요.' })
            }
            setTimeout(() => {
              setRemaining(FOCUS_SEC)
              setPhase('idle')
            }, 0)
          }
          return p
        })
        return 0
      }
      return prev - 1
    })
  }, [stop])

  const start = useCallback(() => {
    if (Notification.permission === 'default') {
      Notification.requestPermission()
    }
    if (phase === 'idle') setRemaining(FOCUS_SEC)
    setPhase(p => p === 'idle' ? 'focus' : p)
    intervalRef.current = setInterval(tick, 1000)
  }, [phase, tick])

  const pause = useCallback(() => {
    stop()
    setPhase(p => p) // keep phase but stop ticking
  }, [stop])

  const reset = useCallback(() => {
    stop()
    setPhase('idle')
    setRemaining(FOCUS_SEC)
  }, [stop])

  useEffect(() => () => stop(), [stop])

  const isRunning = intervalRef.current !== null
  const min = Math.floor(remaining / 60)
  const sec = remaining % 60
  const timeStr = `${String(min).padStart(2, '0')}:${String(sec).padStart(2, '0')}`
  const progress = phase === 'break'
    ? 1 - remaining / BREAK_SEC
    : 1 - remaining / FOCUS_SEC
  const circumference = 2 * Math.PI * 18

  return (
    <div style={{ position: 'relative' }}>
      {/* 헤더 버튼 */}
      <button
        onClick={() => setOpen(v => !v)}
        className="flex items-center gap-1.5 px-2 py-1.5 rounded-lg transition-all text-[11px] font-mono"
        style={{
          background: open ? 'var(--accent-dim)' : isRunning ? 'rgba(139,92,246,0.1)' : 'var(--bg-card)',
          border: `1px solid ${isRunning ? 'var(--accent)' : open ? 'var(--accent)' : 'var(--border)'}`,
          color: isRunning ? 'var(--accent-light)' : open ? 'var(--accent-light)' : 'var(--text-muted)',
        }}
        title="포모도로 타이머"
      >
        <Timer size={13} />
        <span>{isRunning || phase === 'break' ? timeStr : '25:00'}</span>
        {sessions > 0 && (
          <span
            className="ml-0.5 px-1 rounded-full text-[9px] font-bold"
            style={{ background: 'var(--accent-dim)', color: 'var(--accent-light)' }}
          >
            {sessions}
          </span>
        )}
      </button>

      {/* 팝오버 */}
      {open && (
        <div
          style={{
            position: 'absolute', top: '100%', right: 0, marginTop: 6,
            background: 'var(--bg-surface)',
            border: '1px solid var(--border)',
            borderRadius: 16, padding: '20px 24px',
            zIndex: 100, minWidth: 200,
            boxShadow: '0 4px 24px rgba(0,0,0,0.35)',
          }}
        >
          <div className="flex items-center justify-between mb-4">
            <span className="text-[10px] font-semibold tracking-widest uppercase" style={{ color: 'var(--text-dim)' }}>
              {phase === 'break' ? '휴식 중' : phase === 'focus' ? '집중 중' : '포모도로'}
            </span>
            <button onClick={() => setOpen(false)} style={{ color: 'var(--text-dim)' }}>
              <X size={12} />
            </button>
          </div>

          {/* 원형 타이머 */}
          <div className="flex flex-col items-center gap-4">
            <div style={{ position: 'relative', width: 80, height: 80 }}>
              <svg width="80" height="80" viewBox="0 0 40 40" style={{ transform: 'rotate(-90deg)' }}>
                <circle cx="20" cy="20" r="18" fill="none" stroke="var(--border)" strokeWidth="2.5" />
                <circle
                  cx="20" cy="20" r="18"
                  fill="none"
                  stroke={phase === 'break' ? '#10b981' : 'var(--accent)'}
                  strokeWidth="2.5"
                  strokeDasharray={circumference}
                  strokeDashoffset={circumference * (1 - progress)}
                  strokeLinecap="round"
                  style={{ transition: 'stroke-dashoffset 0.9s linear' }}
                />
              </svg>
              <div
                style={{
                  position: 'absolute', inset: 0,
                  display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                }}
              >
                <span className="text-xl font-mono font-bold" style={{ color: 'var(--text-bright)', letterSpacing: '-0.04em' }}>
                  {timeStr}
                </span>
              </div>
            </div>

            {/* 컨트롤 */}
            <div className="flex items-center gap-2">
              {isRunning ? (
                <button
                  onClick={pause}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-medium"
                  style={{ background: 'var(--bg-hover)', border: '1px solid var(--border)', color: 'var(--text)' }}
                >
                  <Pause size={11} /> 일시정지
                </button>
              ) : (
                <button
                  onClick={start}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-medium"
                  style={{ background: 'var(--accent-dim)', border: '1px solid var(--accent)', color: 'var(--accent-light)' }}
                >
                  <Play size={11} />
                  {phase === 'idle' ? '시작' : '재개'}
                </button>
              )}
              <button
                onClick={reset}
                className="p-1.5 rounded-lg"
                style={{ background: 'var(--bg-hover)', border: '1px solid var(--border)', color: 'var(--text-dim)' }}
                title="리셋"
              >
                <RotateCcw size={11} />
              </button>
            </div>

            {/* 세션 카운터 */}
            <div className="flex items-center gap-1.5">
              {Array.from({ length: Math.max(4, sessions + 1) }, (_, i) => (
                <div
                  key={i}
                  style={{
                    width: 8, height: 8, borderRadius: '50%',
                    background: i < sessions ? 'var(--accent)' : 'var(--border)',
                    transition: 'background 0.3s',
                  }}
                />
              ))}
              {sessions > 0 && (
                <span className="text-[10px] ml-1" style={{ color: 'var(--text-dim)' }}>
                  오늘 {sessions}회
                </span>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
