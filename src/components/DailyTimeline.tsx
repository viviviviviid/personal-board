'use client'

import { useState, useEffect, useCallback } from 'react'
import { format, addDays, subDays, isToday } from 'date-fns'
import { ko } from 'date-fns/locale'
import { ChevronLeft, ChevronRight, Plus, X, Check, Trash2 } from 'lucide-react'

interface TimelineEntry {
  id: string
  date: string
  startTime: string
  endTime: string | null
  title: string
  description: string | null
  category: string | null
}

const HOURS = Array.from({ length: 16 }, (_, i) => i + 8) // 08:00 to 23:00

const CATEGORY_STYLES: Record<string, { bg: string; text: string; border: string }> = {
  work: { bg: 'bg-indigo-500/15', text: 'text-indigo-300', border: 'border-indigo-500/40' },
  personal: { bg: 'bg-emerald-500/15', text: 'text-emerald-300', border: 'border-emerald-500/40' },
  exercise: { bg: 'bg-orange-500/15', text: 'text-orange-300', border: 'border-orange-500/40' },
  study: { bg: 'bg-blue-500/15', text: 'text-blue-300', border: 'border-blue-500/40' },
  health: { bg: 'bg-pink-500/15', text: 'text-pink-300', border: 'border-pink-500/40' },
  other: { bg: 'bg-gray-500/15', text: 'text-gray-300', border: 'border-gray-500/40' },
}

const CATEGORY_LABELS: Record<string, string> = {
  work: '업무',
  personal: '개인',
  exercise: '운동',
  study: '학습',
  health: '건강',
  other: '기타',
}

export default function DailyTimeline() {
  const [currentDate, setCurrentDate] = useState(new Date())
  const [entries, setEntries] = useState<TimelineEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [addingAtHour, setAddingAtHour] = useState<number | null>(null)
  const [formData, setFormData] = useState({
    startTime: '',
    endTime: '',
    title: '',
    category: 'work',
  })

  const fetchEntries = useCallback(async () => {
    setLoading(true)
    try {
      const dateParam = format(currentDate, 'yyyy-MM-dd')
      const res = await fetch(`/api/timeline?date=${dateParam}`)
      if (!res.ok) throw new Error('Failed')
      const data = await res.json()
      setEntries(data)
      setError(null)
    } catch {
      setError('타임라인 데이터를 불러올 수 없습니다.')
    } finally {
      setLoading(false)
    }
  }, [currentDate])

  useEffect(() => {
    fetchEntries()
  }, [fetchEntries])

  const openAddForm = (hour: number) => {
    setAddingAtHour(hour)
    setFormData({
      startTime: `${String(hour).padStart(2, '0')}:00`,
      endTime: `${String(hour + 1).padStart(2, '0')}:00`,
      title: '',
      category: 'work',
    })
  }

  const addEntry = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!formData.title.trim()) return

    try {
      const res = await fetch('/api/timeline', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          date: format(currentDate, 'yyyy-MM-dd'),
          startTime: formData.startTime,
          endTime: formData.endTime,
          title: formData.title.trim(),
          category: formData.category,
        }),
      })
      if (!res.ok) throw new Error('Failed')
      setAddingAtHour(null)
      fetchEntries()
    } catch {
      // silent fail
    }
  }

  const deleteEntry = async (entryId: string) => {
    setEntries((prev) => prev.filter((e) => e.id !== entryId))
    try {
      await fetch(`/api/timeline/${entryId}`, { method: 'DELETE' })
    } catch {
      fetchEntries()
    }
  }

  const getEntriesForHour = (hour: number) =>
    entries.filter((e) => {
      const entryHour = parseInt(e.startTime.split(':')[0])
      return entryHour === hour
    })

  const dateIsToday = isToday(currentDate)

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl font-bold text-gray-100">일일 타임라인</h2>
          <p className="text-sm text-gray-500 mt-0.5">
            {format(currentDate, 'yyyy년 MM월 dd일 (EEEE)', { locale: ko })}
            {dateIsToday && (
              <span className="ml-2 px-2 py-0.5 bg-indigo-500/20 text-indigo-400 text-xs rounded-full">
                오늘
              </span>
            )}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setCurrentDate((d) => subDays(d, 1))}
            className="p-2 bg-[#1a1a24] border border-[#2a2a3a] rounded-lg hover:border-indigo-500/50 text-gray-400 hover:text-gray-200 transition-all"
          >
            <ChevronLeft size={18} />
          </button>
          <button
            onClick={() => setCurrentDate(new Date())}
            className="px-3 py-1.5 text-xs bg-[#1a1a24] border border-[#2a2a3a] rounded-lg hover:border-indigo-500/50 text-gray-400 hover:text-gray-200 transition-all"
          >
            오늘
          </button>
          <button
            onClick={() => setCurrentDate((d) => addDays(d, 1))}
            className="p-2 bg-[#1a1a24] border border-[#2a2a3a] rounded-lg hover:border-indigo-500/50 text-gray-400 hover:text-gray-200 transition-all"
          >
            <ChevronRight size={18} />
          </button>
        </div>
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-sm text-red-400">
          {error}
        </div>
      )}

      {/* Timeline */}
      <div className="bg-[#1a1a24] border border-[#2a2a3a] rounded-2xl overflow-hidden">
        {HOURS.map((hour, index) => {
          const hourEntries = getEntriesForHour(hour)
          const isAddingHere = addingAtHour === hour
          const isLast = index === HOURS.length - 1

          return (
            <div
              key={hour}
              className={`flex ${!isLast ? 'border-b border-[#2a2a3a]' : ''}`}
            >
              {/* Time label */}
              <div className="w-16 flex-shrink-0 px-3 py-3 text-xs text-gray-600 font-mono border-r border-[#2a2a3a] flex items-start pt-3">
                {String(hour).padStart(2, '0')}:00
              </div>

              {/* Content area */}
              <div className="flex-1 px-3 py-2 min-h-[52px] group">
                {isAddingHere ? (
                  <form onSubmit={addEntry} className="space-y-2 py-1">
                    <div className="flex gap-2">
                      <input
                        type="time"
                        value={formData.startTime}
                        onChange={(e) => setFormData((f) => ({ ...f, startTime: e.target.value }))}
                        className="bg-[#22222f] border border-[#2a2a3a] rounded-lg px-2 py-1 text-xs text-gray-300 focus:outline-none focus:border-indigo-500/50 w-24"
                      />
                      <span className="text-gray-600 text-xs self-center">~</span>
                      <input
                        type="time"
                        value={formData.endTime}
                        onChange={(e) => setFormData((f) => ({ ...f, endTime: e.target.value }))}
                        className="bg-[#22222f] border border-[#2a2a3a] rounded-lg px-2 py-1 text-xs text-gray-300 focus:outline-none focus:border-indigo-500/50 w-24"
                      />
                      <select
                        value={formData.category}
                        onChange={(e) => setFormData((f) => ({ ...f, category: e.target.value }))}
                        className="bg-[#22222f] border border-[#2a2a3a] rounded-lg px-2 py-1 text-xs text-gray-300 focus:outline-none focus:border-indigo-500/50"
                      >
                        {Object.entries(CATEGORY_LABELS).map(([value, label]) => (
                          <option key={value} value={value}>
                            {label}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={formData.title}
                        onChange={(e) => setFormData((f) => ({ ...f, title: e.target.value }))}
                        placeholder="활동 제목..."
                        className="flex-1 bg-[#22222f] border border-indigo-500/30 rounded-lg px-3 py-1.5 text-sm text-gray-200 placeholder-gray-600 focus:outline-none"
                        autoFocus
                        onKeyDown={(e) => {
                          if (e.key === 'Escape') setAddingAtHour(null)
                        }}
                      />
                      <button
                        type="submit"
                        className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white text-xs rounded-lg transition-colors"
                      >
                        <Check size={14} />
                      </button>
                      <button
                        type="button"
                        onClick={() => setAddingAtHour(null)}
                        className="px-3 py-1.5 bg-[#22222f] hover:bg-[#2a2a3a] text-gray-400 text-xs rounded-lg transition-colors"
                      >
                        <X size={14} />
                      </button>
                    </div>
                  </form>
                ) : (
                  <div className="flex flex-col gap-1">
                    {hourEntries.map((entry) => {
                      const style = CATEGORY_STYLES[entry.category || 'other'] || CATEGORY_STYLES.other
                      return (
                        <div
                          key={entry.id}
                          className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border ${style.bg} ${style.border} group/entry`}
                        >
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className={`text-xs font-mono ${style.text}`}>
                                {entry.startTime}
                                {entry.endTime && ` ~ ${entry.endTime}`}
                              </span>
                              {entry.category && (
                                <span className={`text-xs px-1.5 py-0.5 rounded-full ${style.bg} ${style.text} border ${style.border}`}>
                                  {CATEGORY_LABELS[entry.category] || entry.category}
                                </span>
                              )}
                            </div>
                            <div className="text-sm text-gray-200 font-medium truncate">
                              {entry.title}
                            </div>
                            {entry.description && (
                              <div className="text-xs text-gray-500 truncate">{entry.description}</div>
                            )}
                          </div>
                          <button
                            onClick={() => deleteEntry(entry.id)}
                            className="opacity-0 group-hover/entry:opacity-100 text-gray-600 hover:text-red-400 transition-all"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      )
                    })}
                    {hourEntries.length === 0 && (
                      <button
                        onClick={() => openAddForm(hour)}
                        className="opacity-0 group-hover:opacity-100 flex items-center gap-1 text-xs text-gray-700 hover:text-indigo-400 transition-all py-1"
                      >
                        <Plus size={12} />
                        <span>활동 추가</span>
                      </button>
                    )}
                    {hourEntries.length > 0 && (
                      <button
                        onClick={() => openAddForm(hour)}
                        className="opacity-0 group-hover:opacity-100 flex items-center gap-1 text-xs text-gray-700 hover:text-indigo-400 transition-all py-0.5"
                      >
                        <Plus size={10} />
                        <span>추가</span>
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
