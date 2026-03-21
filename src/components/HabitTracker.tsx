'use client'

import { useState, useEffect } from 'react'
import { format } from 'date-fns'
import { Plus, Check, Flame, X, Trash2 } from 'lucide-react'

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

export default function HabitTracker() {
  const [habits, setHabits] = useState<Habit[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showAddForm, setShowAddForm] = useState(false)
  const [newHabitName, setNewHabitName] = useState('')
  const [newHabitEmoji, setNewHabitEmoji] = useState('✨')
  const [adding, setAdding] = useState(false)
  const [createTodo, setCreateTodo] = useState(false)

  const today = format(new Date(), 'yyyy-MM-dd')

  const fetchHabits = async () => {
    try {
      const res = await fetch(`/api/habits?date=${today}`)
      if (!res.ok) throw new Error('Failed to fetch')
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
  }, [])

  const toggleHabit = async (habitId: string, currentCompleted: boolean) => {
    // Optimistic update
    setHabits((prev) =>
      prev.map((h) =>
        h.id === habitId
          ? {
            ...h,
            logs: h.logs.some((l) => l.habitId === habitId)
              ? h.logs.map((l) => (l.habitId === habitId ? { ...l, completed: !currentCompleted } : l))
              : [...h.logs, { id: 'temp', habitId, date: today, completed: true }],
          }
          : h
      )
    )

    try {
      await fetch('/api/habits/log', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ habitId, date: today, completed: !currentCompleted }),
      })
    } catch {
      fetchHabits() // Revert on error
    }
  }

  const addHabit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newHabitName.trim()) return
    setAdding(true)

    const shouldCreateTodo = createTodo
    try {
      const res = await fetch('/api/habits', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newHabitName.trim(), emoji: newHabitEmoji }),
      })
      if (!res.ok) throw new Error('Failed')
      if (shouldCreateTodo) {
        await fetch('/api/todos', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ title: newHabitName.trim(), date: today }),
        })
      }
      setNewHabitName('')
      setNewHabitEmoji('✨')
      setCreateTodo(false)
      setShowAddForm(false)
      fetchHabits()
    } catch {
      // silent fail
    } finally {
      setAdding(false)
    }
  }

  const deleteHabit = async (habitId: string) => {
    setHabits((prev) => prev.filter((h) => h.id !== habitId))
    try {
      await fetch(`/api/habits/${habitId}`, { method: 'DELETE' })
    } catch {
      fetchHabits()
    }
  }

  const completedCount = habits.filter((h) => h.logs.some((l) => l.completed)).length

  return (
    <div className="bg-[var(--bg-card)] border border-[var(--border-rule)] rounded-xl p-4">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Flame size={18} className="text-[var(--warning)]" />
          <h3 className="text-sm font-semibold text-[var(--text-bright)]">오늘의 습관</h3>
        </div>
        <div className="flex items-center gap-2">
          {habits.length > 0 && (
            <span className="text-xs text-gray-500">
              {completedCount}/{habits.length}
            </span>
          )}
          <button
            onClick={() => setShowAddForm(!showAddForm)}
            className="w-6 h-6 flex items-center justify-center rounded-md bg-[var(--bg-input)] hover:bg-[var(--bg-hover)] text-[var(--text-muted)] hover:text-[var(--accent-light)] transition-colors"
          >
            {showAddForm ? <X size={14} /> : <Plus size={14} />}
          </button>
        </div>
      </div>

      {showAddForm && (
        <form onSubmit={addHabit} className="mb-3 flex flex-col gap-1.5">
          <div className="flex gap-2">
            <input
              type="text"
              value={newHabitEmoji}
              onChange={(e) => setNewHabitEmoji(e.target.value)}
              className="w-10 bg-[var(--bg-input)] border border-[var(--border-dim)] rounded-lg px-2 py-1.5 text-sm text-center"
              maxLength={2}
            />
            <input
              type="text"
              value={newHabitName}
              onChange={(e) => setNewHabitName(e.target.value)}
              placeholder="새 습관 이름..."
              className="flex-1 bg-[var(--bg-input)] border border-[var(--border-dim)] rounded-lg px-3 py-1.5 text-sm text-[var(--text)] placeholder-[var(--text-dim)] focus:outline-none focus:border-[var(--accent)]"
              autoFocus
            />
            <button
              type="submit"
              disabled={adding}
              className="px-3 py-1.5 bg-[var(--accent)] hover:bg-[var(--accent-light)] text-white text-xs rounded-lg transition-colors disabled:opacity-50"
            >
              추가
            </button>
          </div>
          <button
            type="button"
            onClick={() => setCreateTodo(t => !t)}
            className="self-start text-xs px-2 py-0.5 rounded transition-colors"
            style={{
              background: createTodo ? 'var(--accent-dim)' : 'var(--bg-input)',
              color: createTodo ? 'var(--accent-light)' : 'var(--text-dim)',
              border: `1px solid ${createTodo ? 'var(--accent)' : 'var(--border)'}`,
            }}
          >
            TODO도 추가
          </button>
        </form>
      )}

      {loading ? (
        <div className="space-y-1.5 py-1">
          {[75, 55, 65].map((w, i) => (
            <div
              key={i}
              className="h-7 rounded-lg animate-pulse"
              style={{ width: `${w}%`, background: 'var(--bg-card)' }}
            />
          ))}
        </div>
      ) : error ? (
        <div className="text-xs text-red-400/60 py-2">{error}</div>
      ) : habits.length === 0 ? (
        <div className="text-xs text-gray-600 py-2 text-center">
          습관을 추가해 보세요
        </div>
      ) : (
        <div className="space-y-1.5">
          {habits.map((habit) => {
            const isCompleted = habit.logs.some((l) => l.completed)
            return (
              <div
                key={habit.id}
                className="flex items-center gap-2 group"
              >
                <button
                  onClick={() => toggleHabit(habit.id, isCompleted)}
                  className={`w-5 h-5 rounded-md border-2 flex items-center justify-center transition-all flex-shrink-0 ${!isCompleted ? 'hover:border-[var(--accent)]' : ''}`}
                  style={isCompleted ? { background: habit.color || 'var(--accent)', borderColor: habit.color || 'var(--accent)' } : { borderColor: 'var(--border)' }}
                >
                  {isCompleted && <Check size={12} className="text-white" />}
                </button>
                <span className="text-sm">{habit.emoji}</span>
                <span
                  className={`flex-1 text-sm ${isCompleted ? 'line-through text-[var(--text-dim)]' : 'text-[var(--text)]'
                    }`}
                >
                  {habit.name}
                </span>
                <button
                  onClick={() => deleteHabit(habit.id)}
                  className="opacity-0 group-hover:opacity-100 text-gray-600 hover:text-red-400 transition-all"
                >
                  <Trash2 size={12} />
                </button>
              </div>
            )
          })}
        </div>
      )}

      {habits.length > 0 && !loading && !error && (
        <div className="mt-3 pt-3 border-t border-[var(--border-rule)]">
          <div className="flex items-center gap-2">
            <div className="flex-1 bg-[var(--bg-input)] rounded-full h-1.5">
              <div
                className="bg-gradient-to-r from-[var(--accent-light)] to-[var(--accent)] h-1.5 rounded-full transition-all duration-500"
                style={{ width: `${habits.length > 0 ? (completedCount / habits.length) * 100 : 0}%` }}
              />
            </div>
            <span className="text-xs text-gray-600">
              {habits.length > 0 ? Math.round((completedCount / habits.length) * 100) : 0}%
            </span>
          </div>
        </div>
      )}
    </div>
  )
}
