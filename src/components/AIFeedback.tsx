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
      setError('AI 피드백을 가져오는 데 실패했습니다. 잠시 후 다시 시도해 주세요.')
    } finally {
      setLoading(false)
    }
  }

  const formatFeedback = (text: string) => {
    return text.split('\n').map((line, i) => {
      if (line.startsWith('## ')) {
        return (
          <h3 key={i} className="text-base font-semibold text-indigo-400 mt-4 mb-2 first:mt-0">
            {line.replace('## ', '')}
          </h3>
        )
      }
      if (line.startsWith('- ') || line.startsWith('• ')) {
        return (
          <div key={i} className="flex gap-2 text-sm text-gray-300 mb-1">
            <span className="text-indigo-400 mt-0.5">•</span>
            <span>{line.replace(/^[-•] /, '')}</span>
          </div>
        )
      }
      if (line.trim() === '') return <div key={i} className="h-1" />
      return (
        <p key={i} className="text-sm text-gray-300 mb-1">
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
        className="p-1.5 bg-[#1c1c3a] border border-[#28285a] rounded-lg hover:border-indigo-500/50 text-[#8888bb] hover:text-indigo-400 transition-all"
      >
        <Sparkles size={16} />
      </button>

      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => setIsOpen(false)}
          />
          <div className="relative bg-[#1a1a24] border border-[#2a2a3a] rounded-2xl w-full max-w-lg max-h-[80vh] flex flex-col shadow-2xl">
            <div className="flex items-center justify-between px-5 py-4 border-b border-[#2a2a3a]">
              <div className="flex items-center gap-2">
                <Sparkles size={18} className="text-indigo-400" />
                <h2 className="text-base font-semibold text-gray-200">AI 주간 피드백</h2>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-gray-600">
                  {format(weekStart, 'MM/dd')} 주
                </span>
                <button
                  onClick={() => setIsOpen(false)}
                  className="p-1 hover:bg-[#22222f] rounded-lg text-gray-500 hover:text-gray-300 transition-colors"
                >
                  <X size={16} />
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-5">
              {loading && (
                <div className="flex flex-col items-center justify-center py-12 gap-3">
                  <Loader2 size={32} className="text-indigo-400 animate-spin" />
                  <p className="text-sm text-gray-500">AI가 이번 주를 분석하고 있어요...</p>
                </div>
              )}

              {error && (
                <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-4">
                  <p className="text-sm text-red-400">{error}</p>
                </div>
              )}

              {feedback && !loading && (
                <div className="prose prose-invert max-w-none">
                  {formatFeedback(feedback)}
                </div>
              )}
            </div>

            {feedback && !loading && (
              <div className="px-5 py-3 border-t border-[#2a2a3a]">
                <button
                  onClick={getFeedback}
                  className="text-xs text-gray-600 hover:text-indigo-400 transition-colors"
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
