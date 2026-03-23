'use client'

import { useState } from 'react'
import { format } from 'date-fns'
import { Sparkles, X, Loader2, CalendarDays, BarChart2, FolderKanban, RefreshCw } from 'lucide-react'

type Mode = 'weekly' | 'daily' | 'project'

interface AIPanelProps {
  weekStart?: Date
  today?: Date
  projectId?: string
  projectName?: string
  /** 표시할 모드 제한. 미설정 시 모두 표시 */
  modes?: Mode[]
  /** 초기 모드 */
  defaultMode?: Mode
}

const MODES: { key: Mode; label: string; icon: React.ReactNode; loadingMsg: string }[] = [
  { key: 'weekly', label: '주간 회고', icon: <CalendarDays size={13} />, loadingMsg: '이번 주를 분석하고 있어요...' },
  { key: 'daily', label: '일일 브리핑', icon: <BarChart2 size={13} />, loadingMsg: '오늘 하루를 준비하고 있어요...' },
  { key: 'project', label: '프로젝트 진단', icon: <FolderKanban size={13} />, loadingMsg: '프로젝트를 진단하고 있어요...' },
]

export default function AIPanel({
  weekStart,
  today,
  projectId,
  projectName,
  modes,
  defaultMode = 'weekly',
}: AIPanelProps) {
  const availableModes = modes
    ? MODES.filter((m) => modes.includes(m.key))
    : MODES.filter((m) => {
        if (m.key === 'project') return !!projectId
        return true
      })

  const [isOpen, setIsOpen] = useState(false)
  const [mode, setMode] = useState<Mode>(
    availableModes.find((m) => m.key === defaultMode)?.key ?? availableModes[0]?.key ?? 'weekly'
  )
  const [results, setResults] = useState<Partial<Record<Mode, string>>>({})
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const currentMode = MODES.find((m) => m.key === mode)!

  const generate = async (targetMode: Mode = mode) => {
    setLoading(true)
    setError(null)
    setResults((prev) => ({ ...prev, [targetMode]: undefined }))

    try {
      let res: Response

      if (targetMode === 'weekly') {
        const date = weekStart ?? new Date()
        res = await fetch('/api/ai/feedback', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ weekStart: format(date, 'yyyy-MM-dd') }),
        })
        const data = await res.json()
        if (!res.ok) throw new Error(data.error)
        setResults((prev) => ({ ...prev, weekly: data.feedback }))
      } else if (targetMode === 'daily') {
        const date = today ?? new Date()
        res = await fetch('/api/ai/daily-brief', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ date: format(date, 'yyyy-MM-dd') }),
        })
        const data = await res.json()
        if (!res.ok) throw new Error(data.error)
        setResults((prev) => ({ ...prev, daily: data.brief }))
      } else if (targetMode === 'project') {
        res = await fetch('/api/ai/project', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ projectId }),
        })
        const data = await res.json()
        if (!res.ok) throw new Error(data.error)
        setResults((prev) => ({ ...prev, project: data.diagnosis }))
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'AI 응답을 가져오는 데 실패했습니다.')
    } finally {
      setLoading(false)
    }
  }

  const handleOpen = () => {
    setIsOpen(true)
    if (!results[mode]) generate(mode)
  }

  const handleModeChange = (next: Mode) => {
    setMode(next)
    if (!results[next]) generate(next)
  }

  // 인라인 **bold** 파싱
  const renderInline = (text: string) => {
    const parts = text.split(/(\*\*[^*]+\*\*)/)
    if (parts.length === 1) return <>{text}</>
    return (
      <>
        {parts.map((part, j) =>
          part.startsWith('**') && part.endsWith('**')
            ? <strong key={j} style={{ color: 'var(--text-bright)' }}>{part.slice(2, -2)}</strong>
            : part
        )}
      </>
    )
  }

  const formatText = (text: string) =>
    text.split('\n').map((line, i) => {
      if (line.startsWith('## ')) {
        return (
          <h3 key={i} className="text-sm font-semibold mt-5 mb-2 first:mt-0" style={{ color: 'var(--accent-light)' }}>
            {line.replace(/^## /, '')}
          </h3>
        )
      }
      if (/^[-•*] /.test(line)) {
        const content = line.replace(/^[-•*] /, '')
        return (
          <div key={i} className="flex gap-2 text-sm mb-1.5" style={{ color: 'var(--text)' }}>
            <span style={{ color: 'var(--accent)' }} className="mt-0.5 flex-shrink-0">•</span>
            <span>{renderInline(content)}</span>
          </div>
        )
      }
      if (line.startsWith('**') && line.endsWith('**')) {
        return (
          <p key={i} className="text-sm font-semibold mb-1" style={{ color: 'var(--text-bright)' }}>
            {line.replace(/\*\*/g, '')}
          </p>
        )
      }
      if (line.trim() === '---') return <hr key={i} style={{ border: 'none', borderTop: '1px solid var(--border-dim)', margin: '8px 0' }} />
      if (line.trim() === '') return <div key={i} className="h-2" />
      return (
        <p key={i} className="text-sm mb-1.5" style={{ color: 'var(--text)' }}>
          {renderInline(line)}
        </p>
      )
    })

  const subTitle = () => {
    if (mode === 'weekly' && weekStart) return `${format(weekStart, 'MM/dd')} 주`
    if (mode === 'daily' && today) return format(today, 'MM/dd')
    if (mode === 'project' && projectName) return projectName
    return ''
  }

  return (
    <>
      <button
        onClick={handleOpen}
        title="AI 어시스턴트"
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
            style={{ background: 'rgba(0,0,0,0.7)' }}
            onClick={() => setIsOpen(false)}
          />
          <div
            className="relative w-full max-w-lg max-h-[82vh] flex flex-col rounded-2xl overflow-hidden"
            style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: '1px solid var(--border-dim)' }}>
              <div className="flex items-center gap-2">
                <Sparkles size={15} style={{ color: 'var(--accent)' }} />
                <span className="text-sm font-semibold" style={{ color: 'var(--text-bright)' }}>AI 어시스턴트</span>
                {subTitle() && (
                  <span className="text-xs" style={{ color: 'var(--text-dim)' }}>{subTitle()}</span>
                )}
              </div>
              <button
                onClick={() => setIsOpen(false)}
                className="p-1 rounded-lg"
                style={{ color: 'var(--text-dim)' }}
              >
                <X size={15} />
              </button>
            </div>

            {/* Tabs */}
            {availableModes.length > 1 && (
              <div className="flex px-5 pt-3 gap-1" style={{ borderBottom: '1px solid var(--border-dim)' }}>
                {availableModes.map((m) => (
                  <button
                    key={m.key}
                    onClick={() => handleModeChange(m.key)}
                    className="flex items-center gap-1.5 px-3 py-2 text-xs rounded-t-lg transition-all mb-[-1px]"
                    style={{
                      color: mode === m.key ? 'var(--accent-light)' : 'var(--text-muted)',
                      borderBottom: mode === m.key ? '2px solid var(--accent)' : '2px solid transparent',
                      fontWeight: mode === m.key ? 600 : 400,
                    }}
                  >
                    {m.icon}
                    {m.label}
                  </button>
                ))}
              </div>
            )}

            {/* Body */}
            <div className="flex-1 overflow-y-auto p-5">
              {loading && (
                <div className="flex flex-col items-center justify-center py-12 gap-3">
                  <Loader2 size={26} className="animate-spin" style={{ color: 'var(--accent)' }} />
                  <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                    {currentMode.loadingMsg}
                  </p>
                </div>
              )}
              {error && !loading && (
                <div
                  className="rounded-xl p-4 text-sm"
                  style={{
                    background: 'rgba(239,68,68,0.1)',
                    border: '1px solid rgba(239,68,68,0.3)',
                    color: 'var(--danger)',
                  }}
                >
                  {error}
                </div>
              )}
              {results[mode] && !loading && (
                <div>{formatText(results[mode]!)}</div>
              )}
            </div>

            {/* Footer */}
            {(results[mode] || error) && !loading && (
              <div className="px-5 py-3 flex items-center gap-2" style={{ borderTop: '1px solid var(--border-dim)' }}>
                <button
                  onClick={() => generate(mode)}
                  className="flex items-center gap-1.5 text-xs transition-colors"
                  style={{ color: 'var(--text-dim)' }}
                  onMouseEnter={e => (e.currentTarget.style.color = 'var(--accent)')}
                  onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-dim)')}
                >
                  <RefreshCw size={11} />
                  다시 생성
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  )
}
