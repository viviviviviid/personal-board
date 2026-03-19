'use client'

import { useState, useEffect } from 'react'
import { format, subDays, addDays, startOfDay } from 'date-fns'
import { ko } from 'date-fns/locale'
import { Plus, Check, X, Flame, Trash2, ChevronLeft, ChevronRight } from 'lucide-react'

interface HabitLog {
  id: string
  habitId: string
  date: string
  completed: boolean
}

interface Habit {
  id: string
  name: string
  emoji: string | null
  color: string
  logs: HabitLog[]
}

const COLOR_OPTIONS = [
  '#10b981', '#6366f1', '#8b5cf6', '#ec4899',
  '#ef4444', '#f97316', '#eab308', '#3b82f6',
]

export default function HabitsPage() {
  const [currentDate, setCurrentDate] = useState(new Date())
  const [habits, setHabits] = useState<Habit[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showAddForm, setShowAddForm] = useState(false)
  const [formData, setFormData] = useState({ name: '', emoji: '✨', color: '#10b981' })
  const [adding, setAdding] = useState(false)

  const dateStr = format(currentDate, 'yyyy-MM-dd')

  const fetchHabits = async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/habits?date=${dateStr}`)
      if (!res.ok) throw new Error('Failed')
      const data = await res.json()
      setHabits(data)
      setError(null)
    } catch {
      setError('습관 데이터를 불러올 수 없습니다.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchHabits()
  }, [dateStr])

  const toggleHabit = async (habitId: string) => {
    const habit = habits.find((h) => h.id === habitId)
    if (!habit) return
    const currentLog = habit.logs.find((l) => l.habitId === habitId)
    const isCompleted = currentLog?.completed ?? false

    setHabits((prev) =>
      prev.map((h) =>
        h.id === habitId
          ? {
              ...h,
              logs: currentLog
                ? h.logs.map((l) => (l.id === currentLog.id ? { ...l, completed: !isCompleted } : l))
                : [...h.logs, { id: 'temp', habitId, date: dateStr, completed: true }],
            }
          : h
      )
    )

    try {
      await fetch('/api/habits/log', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ habitId, date: dateStr, completed: !isCompleted }),
      })
    } catch {
      fetchHabits()
    }
  }

  const addHabit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!formData.name.trim()) return
    setAdding(true)

    try {
      const res = await fetch('/api/habits', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      })
      if (!res.ok) throw new Error('Failed')
      setFormData({ name: '', emoji: '✨', color: '#10b981' })
      setShowAddForm(false)
      fetchHabits()
    } catch {
      // silent
    } finally {
      setAdding(false)
    }
  }

  const deleteHabit = async (habitId: string) => {
    if (!confirm('습관을 삭제하시겠습니까?')) return
    setHabits((prev) => prev.filter((h) => h.id !== habitId))
    try {
      await fetch(`/api/habits/${habitId}`, { method: 'DELETE' })
    } catch {
      fetchHabits()
    }
  }

  const completedCount = habits.filter((h) => h.logs.some((l) => l.completed)).length
  const isToday = format(currentDate, 'yyyy-MM-dd') === format(new Date(), 'yyyy-MM-dd')

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl font-bold text-gray-100 flex items-center gap-2">
            <Flame className="text-orange-400" size={22} />
            습관 트래커
          </h2>
          <p className="text-sm text-gray-500 mt-0.5">
            {format(currentDate, 'yyyy년 MM월 dd일 (EEEE)', { locale: ko })}
            {isToday && (
              <span className="ml-2 px-2 py-0.5 bg-orange-500/20 text-orange-400 text-xs rounded-full">
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
          <button
            onClick={() => setShowAddForm(!showAddForm)}
            className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-sm rounded-lg transition-colors ml-2"
          >
            {showAddForm ? <X size={16} /> : <Plus size={16} />}
            {showAddForm ? '닫기' : '새 습관'}
          </button>
        </div>
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-sm text-red-400">
          {error}
        </div>
      )}

      {/* Add Habit Form */}
      {showAddForm && (
        <form
          onSubmit={addHabit}
          className="mb-6 bg-[#1a1a24] border border-[#2a2a3a] rounded-xl p-4 space-y-3"
        >
          <h3 className="text-sm font-medium text-gray-300">새 습관 추가</h3>
          <div className="flex gap-2">
            <input
              type="text"
              value={formData.emoji}
              onChange={(e) => setFormData((f) => ({ ...f, emoji: e.target.value }))}
              className="w-12 bg-[#22222f] border border-[#2a2a3a] rounded-lg px-2 py-2 text-sm text-center focus:outline-none focus:border-indigo-500/50"
              maxLength={2}
            />
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData((f) => ({ ...f, name: e.target.value }))}
              placeholder="습관 이름 (예: 물 2L 마시기)"
              className="flex-1 bg-[#22222f] border border-[#2a2a3a] rounded-lg px-3 py-2 text-sm text-gray-200 placeholder-gray-600 focus:outline-none focus:border-indigo-500/50"
              autoFocus
            />
          </div>
          <div>
            <div className="text-xs text-gray-600 mb-2">컬러</div>
            <div className="flex gap-2">
              {COLOR_OPTIONS.map((color) => (
                <button
                  key={color}
                  type="button"
                  onClick={() => setFormData((f) => ({ ...f, color }))}
                  className={`w-7 h-7 rounded-full transition-all ${
                    formData.color === color
                      ? 'ring-2 ring-white ring-offset-2 ring-offset-[#1a1a24] scale-110'
                      : ''
                  }`}
                  style={{ backgroundColor: color }}
                />
              ))}
            </div>
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setShowAddForm(false)}
              className="px-4 py-2 bg-[#22222f] border border-[#2a2a3a] hover:border-gray-600 text-gray-400 text-sm rounded-lg transition-colors"
            >
              취소
            </button>
            <button
              type="submit"
              disabled={adding || !formData.name.trim()}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-sm rounded-lg transition-colors disabled:opacity-50"
            >
              {adding ? '추가 중...' : '습관 추가'}
            </button>
          </div>
        </form>
      )}

      {/* Stats bar */}
      {habits.length > 0 && !loading && (
        <div className="mb-6 bg-[#1a1a24] border border-[#2a2a3a] rounded-xl p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-gray-400">오늘의 달성률</span>
            <span className="text-lg font-bold text-gray-200">
              {completedCount}/{habits.length}
            </span>
          </div>
          <div className="w-full bg-[#22222f] rounded-full h-2.5">
            <div
              className="h-2.5 rounded-full transition-all duration-700"
              style={{
                width: `${habits.length > 0 ? (completedCount / habits.length) * 100 : 0}%`,
                background: 'linear-gradient(90deg, #10b981, #34d399)',
              }}
            />
          </div>
          {completedCount === habits.length && habits.length > 0 && (
            <div className="mt-2 text-sm text-emerald-400 text-center">
              🎉 오늘 모든 습관을 완료했습니다!
            </div>
          )}
        </div>
      )}

      {/* Habit List */}
      {loading ? (
        <div className="space-y-2">
          {[1, 2, 3].map((i) => (
            <div key={i} className="bg-[#1a1a24] border border-[#2a2a3a] rounded-xl h-16 animate-pulse" />
          ))}
        </div>
      ) : habits.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <Flame size={48} className="text-gray-700 mb-4" />
          <h3 className="text-lg font-medium text-gray-400 mb-2">아직 습관이 없습니다</h3>
          <p className="text-sm text-gray-600 mb-6">매일 반복하고 싶은 습관을 추가해 보세요</p>
          <button
            onClick={() => setShowAddForm(true)}
            className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-sm rounded-lg transition-colors"
          >
            <Plus size={16} />첫 습관 추가하기
          </button>
        </div>
      ) : (
        <div className="space-y-2 max-w-lg">
          {habits.map((habit) => {
            const isCompleted = habit.logs.some((l) => l.completed)
            return (
              <div
                key={habit.id}
                className={`flex items-center gap-4 bg-[#1a1a24] border rounded-xl px-4 py-3 transition-all group ${
                  isCompleted
                    ? 'border-emerald-500/20 bg-emerald-500/5'
                    : 'border-[#2a2a3a] hover:border-[#3a3a4a]'
                }`}
              >
                <button
                  onClick={() => toggleHabit(habit.id)}
                  className={`w-6 h-6 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-all ${
                    isCompleted
                      ? 'border-emerald-500 bg-emerald-500'
                      : 'border-gray-600 hover:border-emerald-400'
                  }`}
                  style={isCompleted ? {} : { borderColor: habit.color + '60' }}
                >
                  {isCompleted && <Check size={14} className="text-white" />}
                </button>

                <div className="flex items-center gap-2 flex-1">
                  <span className="text-xl">{habit.emoji || '✨'}</span>
                  <span
                    className={`font-medium ${
                      isCompleted ? 'line-through text-gray-600' : 'text-gray-200'
                    }`}
                  >
                    {habit.name}
                  </span>
                </div>

                {isCompleted && (
                  <span className="text-xs text-emerald-500 font-medium">완료 ✓</span>
                )}

                <button
                  onClick={() => deleteHabit(habit.id)}
                  className="opacity-0 group-hover:opacity-100 text-gray-600 hover:text-red-400 transition-all"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
