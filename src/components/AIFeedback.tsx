'use client'

import { useState } from 'react'
import { format } from 'date-fns'
import { Sparkles, X, Loader2 } from 'lucide-react'

interface AIFeedbackProps {
  weekStart: Date
}

export default function AIFeedback({ weekStart }: AIFeedbackProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [feedback, setFeedback] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const getFeedback = async () => {
    setLoading(true)
    setError(null)
    setFeedback(null)
    setIsOpen(true)

    try {
      const res = await fetch('/api/ai/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ weekStart: format(weekStart, 'yyyy-MM-dd') }),
      })
      if (!res.ok) throw new Error('Failed to get feedback')
      const data = await res.json()
      setFeedback(data.feedback)
    } catch {
      setError('AI 피드백을 가져오는 데 실패했습니다.')
    } finally {
      setLoading(false)
    }
  }

  const formatFeedback = (text: string) => {
    return text.split('\n').map((line, i) => {
      if (line.startsWith('## ')) {
        return (
          <h3 key={i} className="text-base font-semibold mt-5 mb-2 first:mt-0" style={{ color: 'var(--accent-light)' }}>
            {line.replace('## ', '')}
          </h3>
        )
      }
      if (line.startsWith('- ') || line.startsWith('• ')) {
        return (
          <div key={i} className="flex gap-2 text-sm mb-1.5" style={{ color: 'var(--text)' }}>
            <span style={{ color: 'var(--accent)' }} className="mt-0.5 flex-shrink-0">•</span>
            <span>{line.replace(/^[-•] /, '')}</span>
          </div>
        )
      }
      if (line.trim() === '') return <div key={i} className="h-2" />
      return (
        <p key={i} className="text-sm mb-1.5" style={{ color: 'var(--text)' }}>
          {line}
        </p>
      )
    })
  }

  return (
    <>
      <button
        onClick={getFeedback}
        title="AI 주간 피드백"
        className="p-1.5 rounded-lg transition-all"
        style={{
          background: 'var(--bg-card)',
          border: '1px solid var(--border)',
          color: 'var(--text-muted)',
        }}
        onMouseEnter={e => (e.currentTarget.style.color = 'var(--accent-light)')}
        onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-muted)')}
      >
        <Sparkles size={15} />
      </button>

      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 backdrop-blur-sm"
            style={{ background: 'rgba(0, 0, 0, 0.7)' }}
            onClick={() => setIsOpen(false)}
          />
          <div
            className="relative w-full max-w-lg max-h-[80vh] flex flex-col rounded-2xl overflow-hidden border border-[var(--border)]"
            style={{
              background: 'var(--bg-card)',
              border: '1px solid var(--border)',
            }}
          >
            {/* Header */}
            <div
              className="flex items-center justify-between px-5 py-4"
              style={{ borderBottom: '1px solid var(--border-dim)' }}
            >
              <div className="flex items-center gap-2">
                <Sparkles size={16} style={{ color: 'var(--accent)' }} />
                <h2 className="text-base font-semibold" style={{ color: 'var(--text-bright)' }}>
                  AI 주간 피드백
                </h2>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-xs" style={{ color: 'var(--text-dim)' }}>
                  {format(weekStart, 'MM/dd')} 주
                </span>
                <button
                  onClick={() => setIsOpen(false)}
                  className="p-1 rounded-lg transition-colors"
                  style={{ color: 'var(--text-dim)' }}
                >
                  <X size={16} />
                </button>
              </div>
            </div>

            {/* Body */}
            <div className="flex-1 overflow-y-auto p-5">
              {loading && (
                <div className="flex flex-col items-center justify-center py-12 gap-3">
                  <Loader2 size={28} className="animate-spin" style={{ color: 'var(--accent)' }} />
                  <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
                    이번 주를 분석하고 있어요...
                  </p>
                </div>
              )}
              {error && (
                <div
                  className="rounded-xl p-4 text-sm"
                  style={{
                    background: 'rgba(239, 68, 68, 0.1)',
                    border: '1px solid rgba(239, 68, 68, 0.3)',
                    color: 'var(--danger)',
                  }}
                >
                  {error}
                </div>
              )}
              {feedback && !loading && (
                <div>{formatFeedback(feedback)}</div>
              )}
            </div>

            {feedback && !loading && (
              <div
                className="px-5 py-3"
                style={{ borderTop: '1px solid var(--border-dim)' }}
              >
                <button
                  onClick={getFeedback}
                  className="text-xs transition-colors"
                  style={{ color: 'var(--text-dim)' }}
                  onMouseEnter={e => (e.currentTarget.style.color = 'var(--accent)')}
                  onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-dim)')}
                >
                  다시 생성하기
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  )
}
