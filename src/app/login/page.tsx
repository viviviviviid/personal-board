'use client'

import { signIn } from 'next-auth/react'
import { useEffect, useState } from 'react'
import {
  CalendarDays,
  Flame,
  NotebookPen,
  Sparkles,
  ShieldCheck,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react'

const SLIDES = [
  {
    icon: CalendarDays,
    title: '주간 보드',
    desc: '할일과 타임라인을 한눈에.\n우선순위별 관리와 아이젠하워 매트릭스.',
    color: '#8B5CF6',
    bg: 'rgba(139,92,246,0.1)',
  },
  {
    icon: Flame,
    title: '습관 트래커',
    desc: '매일의 루틴을 GitHub 스타일 히트맵으로.\n연속 달성 streak을 쌓아가세요.',
    color: '#f59e0b',
    bg: 'rgba(245,158,11,0.1)',
  },
  {
    icon: NotebookPen,
    title: '메모',
    desc: '마크다운 지원 메모장.\n비밀 메모는 AES-256으로 암호화.',
    color: '#10b981',
    bg: 'rgba(16,185,129,0.1)',
  },
  {
    icon: Sparkles,
    title: 'AI 피드백',
    desc: '주간 회고와 일일 브리핑을 AI가 자동 생성.\n데이터 기반 인사이트를 매일 받아보세요.',
    color: '#06b6d4',
    bg: 'rgba(6,182,212,0.1)',
  },
  {
    icon: ShieldCheck,
    title: '프로젝트 관리',
    desc: '목표를 섹션으로 나누고 진행률을 추적.\nAI 프로젝트 진단으로 블로커를 해소.',
    color: '#ec4899',
    bg: 'rgba(236,72,153,0.1)',
  },
]

function FeatureCarousel() {
  const [current, setCurrent] = useState(0)
  const [animating, setAnimating] = useState(false)

  const goTo = (index: number) => {
    if (animating) return
    setAnimating(true)
    setTimeout(() => {
      setCurrent((index + SLIDES.length) % SLIDES.length)
      setAnimating(false)
    }, 150)
  }

  const prev = () => goTo(current - 1)
  const next = () => goTo(current + 1)

  useEffect(() => {
    const timer = setInterval(() => {
      goTo(current + 1)
    }, 3000)
    return () => clearInterval(timer)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [current])

  const slide = SLIDES[current]
  const Icon = slide.icon

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        width: '100%',
        gap: 24,
        padding: '32px 16px',
      }}
    >
      {/* Slide content */}
      <div
        style={{
          width: '100%',
          maxWidth: 380,
          opacity: animating ? 0 : 1,
          transform: animating ? 'translateY(8px)' : 'translateY(0)',
          transition: 'opacity 0.15s ease, transform 0.15s ease',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 16,
          textAlign: 'center',
          minHeight: 160,
        }}
      >
        {/* Icon */}
        <div
          style={{
            width: 72,
            height: 72,
            borderRadius: 18,
            background: slide.bg,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            border: `1px solid ${slide.color}33`,
          }}
        >
          <Icon size={40} color={slide.color} strokeWidth={1.5} />
        </div>

        {/* Title */}
        <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--text-bright)' }}>
          {slide.title}
        </div>

        {/* Description */}
        <div
          style={{
            fontSize: 14,
            color: 'var(--text-dim)',
            lineHeight: 1.7,
            whiteSpace: 'pre-line',
          }}
        >
          {slide.desc}
        </div>
      </div>

      {/* Controls row */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
        <button
          onClick={prev}
          style={{
            background: 'var(--bg-hover)',
            border: '1px solid var(--border)',
            borderRadius: 8,
            padding: '6px 8px',
            cursor: 'pointer',
            color: 'var(--text-dim)',
            display: 'flex',
            alignItems: 'center',
          }}
        >
          <ChevronLeft size={16} />
        </button>

        {/* Dots */}
        <div style={{ display: 'flex', gap: 6 }}>
          {SLIDES.map((_, i) => (
            <button
              key={i}
              onClick={() => goTo(i)}
              style={{
                width: i === current ? 20 : 8,
                height: 8,
                borderRadius: 4,
                border: 'none',
                background: i === current ? 'var(--accent)' : 'var(--border)',
                cursor: 'pointer',
                padding: 0,
                transition: 'width 0.2s ease, background 0.2s ease',
              }}
            />
          ))}
        </div>

        <button
          onClick={next}
          style={{
            background: 'var(--bg-hover)',
            border: '1px solid var(--border)',
            borderRadius: 8,
            padding: '6px 8px',
            cursor: 'pointer',
            color: 'var(--text-dim)',
            display: 'flex',
            alignItems: 'center',
          }}
        >
          <ChevronRight size={16} />
        </button>
      </div>
    </div>
  )
}

export default function LoginPage() {
  return (
    <div
      style={{
        minHeight: '100vh',
        background: 'var(--bg-base)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '24px 16px',
      }}
    >
      {/* Two-column on md+, stacked on mobile */}
      <div
        style={{
          display: 'flex',
          flexDirection: 'row',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 32,
          width: '100%',
          maxWidth: 860,
        }}
      >
        {/* Left: Carousel */}
        <div
          style={{
            flex: '1 1 320px',
            minWidth: 280,
            maxWidth: 440,
          }}
        >
          <FeatureCarousel />
        </div>

        {/* Right: Login card */}
        <div
          style={{
            flex: '0 0 auto',
            width: 320,
          }}
        >
          <div
            style={{
              padding: '36px 32px',
              borderRadius: 20,
              background: 'var(--bg-surface)',
              border: '1px solid var(--border)',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 24,
            }}
          >
            <div style={{ fontSize: 40, lineHeight: 1 }}>📓</div>

            <div style={{ textAlign: 'center' }}>
              <h1
                className="font-hand"
                style={{ fontSize: 24, color: 'var(--accent-light)', marginBottom: 6 }}
              >
                My Dashboard
              </h1>
              <p style={{ fontSize: 13, color: 'var(--text-dim)' }}>
                개인 생산성 노트
              </p>
            </div>

            <button
              onClick={() => signIn('google', { callbackUrl: '/' })}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                padding: '12px 22px',
                borderRadius: 12,
                background: 'var(--bg-hover)',
                border: '1px solid var(--border)',
                color: 'var(--text)',
                fontSize: 14,
                fontWeight: 500,
                cursor: 'pointer',
                width: '100%',
                justifyContent: 'center',
                transition: 'background 0.15s ease',
              }}
            >
              <svg width="18" height="18" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
              </svg>
              Google로 로그인
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
