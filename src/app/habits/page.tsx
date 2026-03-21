'use client'

import { useState, useEffect } from 'react'
import { useSwipe } from '@/hooks/useSwipe'
import { format, subDays, addDays } from 'date-fns'
import { ko } from 'date-fns/locale'
import { Plus, Check, X, Flame, Trash2, ChevronLeft, ChevronRight } from 'lucide-react'

interface HabitLog {
  id: string
  habitId: string
  date: string
  completed: boolean
}

interface WeekDay {
  date: string
  completed: boolean
}

interface Habit {
  id: string
  name: string
  emoji: string | null
  color: string
  logs: HabitLog[]
  streak: number
  weekHistory: WeekDay[]
}

const COLOR_OPTIONS = [
  '#c78928', '#95a586', '#688ac4', '#c47858',
  '#a858c4', '#58c4a8', '#c45878', '#7878c4',
]

const WEEK_LABELS = ['월', '화', '수', '목', '금', '토', '일']

export default function HabitsPage() {
  const [currentDate, setCurrentDate] = useState(new Date())
  const [habits, setHabits] = useState<Habit[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showAddForm, setShowAddForm] = useState(false)
  const [formData, setFormData] = useState({ name: '', emoji: '✨', color: '#c78928' })
  const [adding, setAdding] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState<{ id: string; name: string } | null>(null)

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

  useEffect(() => { fetchHabits() }, [dateStr])

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
      setFormData({ name: '', emoji: '✨', color: '#c78928' })
      setShowAddForm(false)
      fetchHabits()
    } catch {
      // silent
    } finally {
      setAdding(false)
    }
  }

  const deleteHabit = async (habitId: string) => {
    setHabits((prev) => prev.filter((h) => h.id !== habitId))
    setConfirmDelete(null)
    try {
      await fetch(`/api/habits/${habitId}`, { method: 'DELETE' })
    } catch {
      fetchHabits()
    }
  }

  const completedCount = habits.filter((h) => h.logs.some((l) => l.completed)).length
  const isToday = format(currentDate, 'yyyy-MM-dd') === format(new Date(), 'yyyy-MM-dd')

  const [slideDir, setSlideDir] = useState<'next' | 'prev' | null>(null)

  const swipeHandlers = useSwipe(
    () => { setSlideDir('next'); setCurrentDate(d => addDays(d, 1)) },
    () => { setSlideDir('prev'); setCurrentDate(d => subDays(d, 1)) },
  )

  return (
    <div {...swipeHandlers} style={{ minHeight: '100%' }}>
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-bold flex items-center gap-2" style={{ color: 'var(--text-bright)' }}>
            <Flame style={{ color: 'var(--warning)' }} size={22} />
            습관 트래커
          </h2>
          <button
            onClick={() => setShowAddForm(!showAddForm)}
            className="flex items-center gap-1.5 px-3 py-2 text-sm rounded-lg transition-all"
            style={{
              background: showAddForm ? 'var(--bg-card)' : 'var(--accent-dim)',
              border: '1px solid var(--border)',
              color: showAddForm ? 'var(--text-muted)' : 'var(--accent-light)',
            }}
          >
            {showAddForm ? <X size={15} /> : <Plus size={15} />}
            <span className="hidden sm:inline">{showAddForm ? '닫기' : '새 습관'}</span>
          </button>
        </div>
        <div className="flex items-center justify-between mt-2">
          <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
            {format(currentDate, 'MM월 dd일 (EEEE)', { locale: ko })}
            {isToday && (
              <span
                className="ml-2 px-2 py-0.5 text-xs rounded-full"
                style={{ background: 'rgba(199,137,40,0.15)', color: 'var(--accent-light)', border: '1px solid rgba(199,137,40,0.3)' }}
              >
                오늘
              </span>
            )}
          </p>
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => { setSlideDir('prev'); setCurrentDate((d) => subDays(d, 1)) }}
              className="p-1.5 rounded-lg transition-all"
              style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', color: 'var(--text-muted)' }}
            >
              <ChevronLeft size={16} />
            </button>
            <button
              onClick={() => setCurrentDate(new Date())}
              className="px-2.5 py-1 text-xs rounded-lg transition-all"
              style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', color: 'var(--text-muted)' }}
            >
              오늘
            </button>
            <button
              onClick={() => { setSlideDir('next'); setCurrentDate((d) => addDays(d, 1)) }}
              className="p-1.5 rounded-lg transition-all"
              style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', color: 'var(--text-muted)' }}
            >
              <ChevronRight size={16} />
            </button>
          </div>
        </div>
      </div>

      <div
        key={dateStr}
        className={slideDir === 'next' ? 'week-slide-next' : slideDir === 'prev' ? 'week-slide-prev' : ''}
        onAnimationEnd={() => setSlideDir(null)}
      >

      {error && (
        <div
          className="mb-4 p-3 rounded-xl text-sm"
          style={{ background: 'rgba(168,88,72,0.1)', border: '1px solid rgba(168,88,72,0.3)', color: 'var(--danger)' }}
        >
          {error}
        </div>
      )}

      {/* Add Habit Form */}
      {showAddForm && (
        <form
          onSubmit={addHabit}
          className="mb-6 rounded-xl p-4 space-y-3"
          style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}
        >
          <h3 className="text-sm font-semibold" style={{ color: 'var(--text-bright)' }}>새 습관 추가</h3>
          <div className="flex gap-2">
            <input
              type="text"
              value={formData.emoji}
              onChange={(e) => setFormData((f) => ({ ...f, emoji: e.target.value }))}
              className="w-12 rounded-lg px-2 py-2 text-sm text-center focus:outline-none"
              style={{ background: 'var(--bg-input)', border: '1px solid var(--border)', color: 'var(--text)' }}
              maxLength={2}
            />
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData((f) => ({ ...f, name: e.target.value }))}
              placeholder="습관 이름 (예: 물 2L 마시기)"
              className="flex-1 rounded-lg px-3 py-2 text-sm focus:outline-none"
              style={{
                background: 'var(--bg-input)',
                border: '1px solid var(--border)',
                color: 'var(--text)',
              }}
              autoFocus
            />
          </div>
          <div>
            <div className="text-xs mb-2" style={{ color: 'var(--text-dim)' }}>컬러</div>
            <div className="flex gap-2">
              {COLOR_OPTIONS.map((color) => (
                <button
                  key={color}
                  type="button"
                  onClick={() => setFormData((f) => ({ ...f, color }))}
                  className={`w-7 h-7 rounded-full transition-all ${formData.color === color ? 'scale-110' : ''}`}
                  style={{
                    backgroundColor: color,
                    boxShadow: formData.color === color ? `0 0 0 2px var(--bg-card), 0 0 0 3px ${color}` : 'none',
                  }}
                />
              ))}
            </div>
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setShowAddForm(false)}
              className="px-4 py-2 text-sm rounded-lg transition-all"
              style={{ background: 'var(--bg-input)', border: '1px solid var(--border)', color: 'var(--text-muted)' }}
            >
              취소
            </button>
            <button
              type="submit"
              disabled={adding || !formData.name.trim()}
              className="px-4 py-2 text-sm rounded-lg transition-all disabled:opacity-50"
              style={{ background: 'var(--accent-dim)', border: '1px solid var(--accent)', color: 'var(--accent-light)' }}
            >
              {adding ? '추가 중...' : '습관 추가'}
            </button>
          </div>
        </form>
      )}

      {/* Stats bar */}
      {habits.length > 0 && !loading && (
        <div
          className="mb-6 rounded-xl p-4"
          style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm" style={{ color: 'var(--text-muted)' }}>오늘의 달성률</span>
            <span className="text-xl font-bold" style={{ color: 'var(--text-bright)' }}>
              {completedCount}/{habits.length}
            </span>
          </div>
          <div className="w-full rounded-full h-2" style={{ background: 'var(--bg-input)' }}>
            <div
              className="h-2 rounded-full transition-all duration-700"
              style={{
                width: `${habits.length > 0 ? (completedCount / habits.length) * 100 : 0}%`,
                background: 'linear-gradient(90deg, var(--success-dim), var(--success))',
              }}
            />
          </div>
          {completedCount === habits.length && habits.length > 0 && (
            <div className="mt-2 text-sm text-center" style={{ color: 'var(--success)' }}>
              🎉 오늘 모든 습관을 완료했습니다!
            </div>
          )}
        </div>
      )}

      {/* Habit List */}
      {loading ? (
        <div className="space-y-2">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="rounded-xl h-20 animate-pulse"
              style={{ background: 'var(--bg-card)', border: '1px solid var(--border-dim)' }}
            />
          ))}
        </div>
      ) : habits.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <Flame size={48} className="mb-4" style={{ color: 'var(--border)' }} />
          <h3 className="text-lg font-medium mb-2" style={{ color: 'var(--text-muted)' }}>아직 습관이 없습니다</h3>
          <p className="text-sm mb-6" style={{ color: 'var(--text-dim)' }}>매일 반복하고 싶은 습관을 추가해 보세요</p>
          <button
            onClick={() => setShowAddForm(true)}
            className="flex items-center gap-2 px-4 py-2 text-sm rounded-lg"
            style={{ background: 'var(--accent-dim)', border: '1px solid var(--accent)', color: 'var(--accent-light)' }}
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
                className="rounded-xl px-4 py-3 transition-all group"
                style={{
                  background: isCompleted ? `${habit.color}08` : 'var(--bg-card)',
                  border: `1px solid ${isCompleted ? habit.color + '30' : 'var(--border)'}`,
                }}
              >
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => toggleHabit(habit.id)}
                    className="w-6 h-6 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-all"
                    style={{
                      background: isCompleted ? habit.color : 'transparent',
                      borderColor: isCompleted ? habit.color : 'var(--border)',
                    }}
                  >
                    {isCompleted && <Check size={14} style={{ color: 'var(--bg-base)' }} />}
                  </button>

                  <div className="flex items-center gap-2 flex-1 min-w-0">
                    <span className="text-xl flex-shrink-0">{habit.emoji || '✨'}</span>
                    <span
                      className="font-medium truncate"
                      style={{ color: isCompleted ? 'var(--text-dim)' : 'var(--text)', textDecoration: isCompleted ? 'line-through' : 'none' }}
                    >
                      {habit.name}
                    </span>
                  </div>

                  {/* Streak badge */}
                  {habit.streak > 0 && (
                    <div
                      className="flex items-center gap-1 px-2 py-0.5 rounded-full flex-shrink-0"
                      style={{ background: 'rgba(196,147,90,0.15)', border: '1px solid rgba(196,147,90,0.3)' }}
                    >
                      <Flame size={11} style={{ color: 'var(--warning)' }} />
                      <span className="text-xs font-semibold" style={{ color: 'var(--warning)' }}>{habit.streak}</span>
                    </div>
                  )}

                  {isCompleted && (
                    <span className="text-xs font-medium flex-shrink-0" style={{ color: 'var(--success)' }}>완료 ✓</span>
                  )}

                  <button
                    onClick={() => setConfirmDelete({ id: habit.id, name: habit.name })}
                    className="md:opacity-0 md:group-hover:opacity-100 transition-all flex-shrink-0 p-1 rounded"
                    style={{ color: 'var(--text-dim)' }}
                    onTouchStart={e => (e.currentTarget.style.opacity = '1')}
                    onTouchEnd={e => (e.currentTarget.style.opacity = '')}
                  >
                    <Trash2 size={14} />
                  </button>
                </div>

                {/* Week history */}
                {habit.weekHistory && (
                  <div className="flex items-center gap-1.5 mt-2.5 pl-9">
                    {habit.weekHistory.map((day, i) => (
                      <div key={i} className="flex flex-col items-center gap-0.5">
                        <div
                          className="w-4 h-4 rounded-sm transition-colors"
                          style={{
                            background: day.completed ? habit.color : 'var(--bg-input)',
                            opacity: day.completed ? 1 : 0.5,
                          }}
                          title={day.date}
                        />
                        <span className="text-[8px]" style={{ color: 'var(--text-dim)' }}>{WEEK_LABELS[i]}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
      </div>

      {/* Delete Confirm Modal */}
      {confirmDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 backdrop-blur-sm"
            style={{ background: 'rgba(10,8,4,0.7)' }}
            onClick={() => setConfirmDelete(null)}
          />
          <div
            className="relative w-full max-w-sm rounded-2xl p-6 shadow-2xl"
            style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}
          >
            <div
              className="w-10 h-10 rounded-full flex items-center justify-center mb-4"
              style={{ background: 'rgba(239,68,68,0.1)' }}
            >
              <Trash2 size={18} style={{ color: 'var(--danger)' }} />
            </div>
            <h3 className="font-semibold mb-1" style={{ color: 'var(--text-bright)' }}>습관 삭제</h3>
            <p className="text-sm mb-6" style={{ color: 'var(--text-muted)' }}>
              <span style={{ color: 'var(--text-bright)', fontWeight: 600 }}>"{confirmDelete.name}"</span>을 삭제할까요?
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setConfirmDelete(null)}
                className="flex-1 py-2 text-sm rounded-xl"
                style={{ background: 'var(--bg-input)', border: '1px solid var(--border)', color: 'var(--text-muted)' }}
              >
                취소
              </button>
              <button
                onClick={() => deleteHabit(confirmDelete.id)}
                className="flex-1 py-2 text-sm rounded-xl font-medium"
                style={{ background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.3)', color: 'var(--danger)' }}
              >
                삭제
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
