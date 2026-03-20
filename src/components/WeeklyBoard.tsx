'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { format, addWeeks, subWeeks, startOfWeek, addDays, isSameDay, isToday } from 'date-fns'
import { ChevronLeft, ChevronRight, Plus, Check, X } from 'lucide-react'
import AIFeedback from './AIFeedback'
import {
  FIRST_HOUR, LAST_HOUR, ROW_H, SNAP, TOTAL_H,
  timeToY, yToTime, addOneHour, nowToY,
} from '@/lib/timeUtils'

// ── Types ──────────────────────────────────────────────────────────────────
interface Todo {
  id: string
  title: string
  completed: boolean
  priority: string
  date: string | null
}

interface TimelineEntry {
  id: string
  date: string
  startTime: string
  endTime: string | null
  title: string
  category: string | null
}

// ── Constants ──────────────────────────────────────────────────────────────
const HOURS = Array.from({ length: LAST_HOUR - FIRST_HOUR + 1 }, (_, i) => i + FIRST_HOUR)
const DAYS_KO = ['월', '화', '수', '목', '금', '토', '일']

// Warm notebook category colors
const CAT_STYLE: Record<string, { bg: string; text: string; border: string }> = {
  work:     { bg: 'rgba(199,137,40,0.15)',  text: '#f2c063', border: 'rgba(199,137,40,0.35)' },
  personal: { bg: 'rgba(149,165,134,0.15)', text: '#b0c8a0', border: 'rgba(149,165,134,0.35)' },
  exercise: { bg: 'rgba(196,109,80,0.15)',  text: '#e0987a', border: 'rgba(196,109,80,0.35)' },
  study:    { bg: 'rgba(104,136,196,0.15)', text: '#88aad8', border: 'rgba(104,136,196,0.35)' },
}
const DEF_STYLE = { bg: 'var(--bg-hover)', text: 'var(--text-muted)', border: 'var(--border)' }

const PRIORITY_COLOR: Record<string, string> = {
  high:   '#a85848',
  medium: '#c4935a',
  low:    '#95a586',
}

// ── Entry block ────────────────────────────────────────────────────────────
interface EntryBlockProps {
  entry: TimelineEntry
  onDelete: () => void
  onDragStart: (e: React.MouseEvent, type: 'move' | 'resize') => void
}

function EntryBlock({ entry, onDelete, onDragStart }: EntryBlockProps) {
  const top = timeToY(entry.startTime)
  const effEnd = entry.endTime || addOneHour(entry.startTime)
  const height = Math.max(20, timeToY(effEnd) - top)
  const s = CAT_STYLE[entry.category || ''] ?? DEF_STYLE

  return (
    <div
      style={{
        position: 'absolute', top, left: 3, right: 3, height, zIndex: 10,
        background: s.bg, border: `1px solid ${s.border}`, color: s.text,
        borderRadius: 6,
      }}
      className="text-[10px] overflow-hidden group select-none"
      onMouseDown={e => { e.stopPropagation(); onDragStart(e, 'move') }}
    >
      <div className="px-1.5 pt-0.5 pb-4 h-full overflow-hidden cursor-grab active:cursor-grabbing">
        <div className="font-mono text-[9px] opacity-55 tabular-nums leading-none">
          {entry.startTime}{entry.endTime ? ` – ${entry.endTime}` : ''}
        </div>
        <div className="mt-0.5 leading-tight font-medium truncate">{entry.title}</div>
      </div>
      {/* delete */}
      <button
        style={{ position: 'absolute', top: 3, right: 3 }}
        className="opacity-0 group-hover:opacity-100 transition-opacity"
        onMouseDown={e => e.stopPropagation()}
        onClick={e => { e.stopPropagation(); onDelete() }}
      >
        <X size={9} />
      </button>
      {/* resize handle */}
      <div
        style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 10, cursor: 'ns-resize' }}
        className="flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
        onMouseDown={e => { e.stopPropagation(); onDragStart(e, 'resize') }}
      >
        <div className="w-8 h-[2px] rounded-full bg-current opacity-40" />
      </div>
    </div>
  )
}

// ── Main component ─────────────────────────────────────────────────────────
export default function WeeklyBoard() {
  const [currentWeekStart, setCurrentWeekStart] = useState(() =>
    startOfWeek(new Date(), { weekStartsOn: 1 })
  )
  const [todos, setTodos] = useState<Todo[]>([])
  const [timeline, setTimeline] = useState<TimelineEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [now, setNow] = useState(new Date())

  const [addingTodoDay, setAddingTodoDay] = useState<string | null>(null)
  const [newTodoTitle, setNewTodoTitle] = useState('')
  const [addingEntry, setAddingEntry] = useState<{ dateKey: string; hour: number } | null>(null)
  const [newEntry, setNewEntry] = useState({ title: '', endTime: '', category: '' })

  // Current time
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 60000)
    return () => clearInterval(t)
  }, [])

  const dragRef = useRef<{
    type: 'move' | 'resize'
    entryId: string
    startMouseY: number
    startY: number
    durationPx: number
  } | null>(null)
  const didDragRef = useRef(false)
  const timelineRef = useRef<TimelineEntry[]>([])
  useEffect(() => { timelineRef.current = timeline }, [timeline])

  const columnRefs = useRef<(HTMLDivElement | null)[]>([])
  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(currentWeekStart, i))

  // ── Fetch ────────────────────────────────────────────────────────────────
  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const wp = format(currentWeekStart, 'yyyy-MM-dd')
      const [tr, tl] = await Promise.all([
        fetch(`/api/todos?week=${wp}`),
        fetch(`/api/timeline?week=${wp}`),
      ])
      if (tr.ok) setTodos(await tr.json())
      if (tl.ok) setTimeline(await tl.json())
      setError(null)
    } catch {
      setError('데이터를 불러올 수 없습니다.')
    } finally {
      setLoading(false)
    }
  }, [currentWeekStart])

  useEffect(() => { fetchData() }, [fetchData])

  // ── Handlers ─────────────────────────────────────────────────────────────
  const toggleTodo = async (id: string, completed: boolean) => {
    setTodos(prev => prev.map(t => t.id === id ? { ...t, completed: !completed } : t))
    await fetch(`/api/todos/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ completed: !completed }),
    }).catch(() => fetchData())
  }

  const deleteTodo = async (id: string) => {
    setTodos(prev => prev.filter(t => t.id !== id))
    await fetch(`/api/todos/${id}`, { method: 'DELETE' }).catch(() => fetchData())
  }

  const submitTodo = async (day: Date) => {
    if (!newTodoTitle.trim()) { setAddingTodoDay(null); return }
    const tempId = `temp-${Date.now()}`
    const todo: Todo = { id: tempId, title: newTodoTitle.trim(), completed: false, priority: 'medium', date: day.toISOString() }
    setTodos(prev => [...prev, todo])
    setNewTodoTitle('')
    setAddingTodoDay(null)
    try {
      const res = await fetch('/api/todos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: todo.title, date: format(day, 'yyyy-MM-dd') }),
      })
      const created = await res.json()
      setTodos(prev => prev.map(t => t.id === tempId ? created : t))
    } catch {
      setTodos(prev => prev.filter(t => t.id !== tempId))
    }
  }

  const submitEntry = async (day: Date, hour: number) => {
    if (!newEntry.title.trim()) { setAddingEntry(null); return }
    const startTime = `${String(hour).padStart(2, '0')}:00`
    const tempId = `temp-${Date.now()}`
    const entry: TimelineEntry = {
      id: tempId, date: day.toISOString(), startTime,
      endTime: newEntry.endTime || addOneHour(startTime),
      title: newEntry.title.trim(), category: newEntry.category || null,
    }
    setTimeline(prev => [...prev, entry])
    setNewEntry({ title: '', endTime: '', category: '' })
    setAddingEntry(null)
    try {
      const res = await fetch('/api/timeline', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          date: format(day, 'yyyy-MM-dd'), startTime,
          endTime: entry.endTime, title: entry.title,
          category: entry.category || undefined,
        }),
      })
      const created = await res.json()
      setTimeline(prev => prev.map(e => e.id === tempId ? created : e))
    } catch {
      setTimeline(prev => prev.filter(e => e.id !== tempId))
    }
  }

  const deleteEntry = async (id: string) => {
    setTimeline(prev => prev.filter(e => e.id !== id))
    await fetch(`/api/timeline/${id}`, { method: 'DELETE' }).catch(() => fetchData())
  }

  // ── Drag ─────────────────────────────────────────────────────────────────
  const handleDragStart = useCallback((
    e: React.MouseEvent,
    entry: TimelineEntry,
    type: 'move' | 'resize',
  ) => {
    e.preventDefault()
    const effEnd = entry.endTime || addOneHour(entry.startTime)
    const startY = timeToY(entry.startTime)
    const durationPx = timeToY(effEnd) - startY
    dragRef.current = { type, entryId: entry.id, startMouseY: e.clientY, startY, durationPx }

    const onMove = (ev: MouseEvent) => {
      const drag = dragRef.current
      if (!drag) return
      const delta = ev.clientY - drag.startMouseY
      if (Math.abs(delta) > 3) didDragRef.current = true
      if (drag.type === 'move') {
        const newStartY = Math.max(0, drag.startY + delta)
        setTimeline(prev => prev.map(t => t.id === drag.entryId
          ? { ...t, startTime: yToTime(newStartY), endTime: yToTime(newStartY + drag.durationPx) } : t
        ))
      } else {
        const newDurPx = Math.max(ROW_H / 4, drag.durationPx + delta)
        setTimeline(prev => prev.map(t => t.id === drag.entryId
          ? { ...t, endTime: yToTime(drag.startY + newDurPx) } : t
        ))
      }
    }

    const onUp = () => {
      const drag = dragRef.current
      if (!drag) return
      dragRef.current = null
      document.removeEventListener('mousemove', onMove)
      document.removeEventListener('mouseup', onUp)
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
      setTimeout(() => { didDragRef.current = false }, 0)
      if (!drag.entryId.startsWith('temp-')) {
        const updated = timelineRef.current.find(t => t.id === drag.entryId)
        if (updated) {
          fetch(`/api/timeline/${drag.entryId}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ startTime: updated.startTime, endTime: updated.endTime }),
          }).catch(() => fetchData())
        }
      }
    }

    document.body.style.cursor = type === 'resize' ? 'ns-resize' : 'grabbing'
    document.body.style.userSelect = 'none'
    document.addEventListener('mousemove', onMove)
    document.addEventListener('mouseup', onUp)
  }, [fetchData])

  // ── Helpers ──────────────────────────────────────────────────────────────
  const todosForDay = (day: Date) =>
    todos.filter(t => t.date && isSameDay(new Date(t.date), day))
  const entriesForDay = (day: Date) =>
    timeline.filter(e => isSameDay(new Date(e.date), day))
  const weekLabel = `${format(currentWeekStart, 'yyyy.MM.dd')} — ${format(addDays(currentWeekStart, 6), 'MM.dd')}`
  const nowY = nowToY(now)
  const gridCols = `44px repeat(7, minmax(0, 1fr))`

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>

      {/* Header */}
      <div className="flex items-center justify-between mb-4 flex-shrink-0">
        <div>
          <h1 className="text-lg font-bold" style={{ color: 'var(--text-bright)' }}>주간 보드</h1>
          <p className="text-xs mt-0.5" style={{ color: 'var(--text-dim)' }}>{weekLabel}</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setCurrentWeekStart(d => subWeeks(d, 1))}
            className="p-1.5 rounded-lg transition-all"
            style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', color: 'var(--text-muted)' }}
          >
            <ChevronLeft size={15} />
          </button>
          <button
            onClick={() => setCurrentWeekStart(startOfWeek(new Date(), { weekStartsOn: 1 }))}
            className="px-2.5 py-1 text-xs rounded-lg transition-all"
            style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', color: 'var(--text-muted)' }}
          >
            이번 주
          </button>
          <button
            onClick={() => setCurrentWeekStart(d => addWeeks(d, 1))}
            className="p-1.5 rounded-lg transition-all"
            style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', color: 'var(--text-muted)' }}
          >
            <ChevronRight size={15} />
          </button>
          <AIFeedback weekStart={currentWeekStart} />
        </div>
      </div>

      {error && (
        <div
          className="mb-3 p-2 rounded-lg text-xs flex-shrink-0"
          style={{ background: 'rgba(168,88,72,0.1)', border: '1px solid rgba(168,88,72,0.3)', color: 'var(--danger)' }}
        >
          {error}
        </div>
      )}

      {/* Grid */}
      <div
        className="flex-1 overflow-auto rounded-xl"
        style={{ minWidth: 0, border: '1px solid var(--border)' }}
      >
        <div style={{ display: 'grid', gridTemplateColumns: gridCols, minWidth: '760px' }}>

          {/* ── Day headers (sticky) ── */}
          <div
            className="sticky top-0 z-30"
            style={{ background: 'var(--bg-surface)', borderBottom: '1px solid var(--border)' }}
          />
          {weekDays.map((day, i) => {
            const today = isToday(day)
            return (
              <div
                key={i}
                className="sticky top-0 z-30 px-2 py-2"
                style={{
                  background: today ? 'rgba(199,137,40,0.08)' : 'var(--bg-surface)',
                  borderLeft: '1px solid var(--border)',
                  borderBottom: '1px solid var(--border)',
                }}
              >
                <div
                  className="text-[11px] font-semibold tracking-wide"
                  style={{ color: today ? 'var(--accent)' : i >= 5 ? '#a07060' : 'var(--text-dim)' }}
                >
                  {DAYS_KO[i]}
                </div>
                <div
                  className="text-xl font-bold leading-tight"
                  style={{ color: today ? 'var(--accent-light)' : 'var(--text-bright)' }}
                >
                  {format(day, 'd')}
                </div>
                <div className="text-[9px]" style={{ color: 'var(--text-dim)' }}>{format(day, 'MM/dd')}</div>
              </div>
            )
          })}

          {/* ── To-do section ── */}
          <div
            className="flex items-start justify-end pr-1.5 pt-2"
            style={{ background: 'var(--bg-card)', borderBottom: '1px solid var(--border)' }}
          >
            <span className="text-[9px] tracking-widest font-semibold" style={{ color: 'var(--text-dim)' }}>TO-DO</span>
          </div>
          {weekDays.map((day, i) => {
            const dayKey = format(day, 'yyyy-MM-dd')
            const dayTodos = todosForDay(day)
            const isAdding = addingTodoDay === dayKey
            const today = isToday(day)
            return (
              <div
                key={i}
                className="p-1.5"
                style={{
                  background: today ? 'rgba(199,137,40,0.05)' : 'var(--bg-card)',
                  borderLeft: '1px solid var(--border)',
                  borderBottom: '1px solid var(--border)',
                  minHeight: 80,
                }}
              >
                {loading ? (
                  <div className="text-center pt-5" style={{ color: 'var(--border)' }}>···</div>
                ) : (
                  <div className="space-y-0.5">
                    {dayTodos.map(todo => (
                      <div
                        key={todo.id}
                        className="flex items-start gap-1 group px-0.5 py-0.5 rounded transition-colors"
                        style={{ '--hover-bg': 'var(--bg-hover)' } as React.CSSProperties}
                        onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-hover)')}
                        onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                      >
                        <button
                          onClick={() => toggleTodo(todo.id, todo.completed)}
                          className="mt-[2px] w-3.5 h-3.5 rounded-sm flex-shrink-0 flex items-center justify-center transition-all"
                          style={{
                            background: todo.completed ? 'var(--accent-dim)' : 'transparent',
                            border: `1px solid ${todo.completed ? 'var(--accent)' : 'var(--border)'}`,
                          }}
                        >
                          {todo.completed && <Check size={8} style={{ color: 'var(--accent-light)' }} />}
                        </button>
                        {/* Priority dot */}
                        <div
                          className="mt-[5px] w-1.5 h-1.5 rounded-full flex-shrink-0"
                          style={{
                            background: PRIORITY_COLOR[todo.priority] ?? PRIORITY_COLOR.medium,
                            opacity: todo.completed ? 0.3 : 0.8,
                          }}
                        />
                        <span
                          className="text-[11px] leading-4 flex-1 min-w-0 break-words"
                          style={{ color: todo.completed ? 'var(--text-dim)' : 'var(--text)', textDecoration: todo.completed ? 'line-through' : 'none' }}
                        >
                          {todo.title}
                        </span>
                        <button
                          onClick={() => deleteTodo(todo.id)}
                          className="opacity-0 group-hover:opacity-100 transition-all flex-shrink-0 mt-[2px]"
                          style={{ color: 'var(--text-dim)' }}
                        >
                          <X size={9} />
                        </button>
                      </div>
                    ))}
                    {isAdding ? (
                      <div className="flex items-center gap-1 pt-0.5">
                        <input
                          type="text"
                          value={newTodoTitle}
                          onChange={e => setNewTodoTitle(e.target.value)}
                          onKeyDown={e => {
                            if (e.key === 'Enter') submitTodo(day)
                            if (e.key === 'Escape') { setAddingTodoDay(null); setNewTodoTitle('') }
                          }}
                          placeholder="할일..."
                          className="flex-1 min-w-0 text-[11px] focus:outline-none rounded px-1.5 py-0.5"
                          style={{
                            background: 'var(--bg-input)',
                            border: '1px solid var(--accent-dim)',
                            color: 'var(--text)',
                          }}
                          autoFocus
                        />
                        <button onClick={() => submitTodo(day)} style={{ color: 'var(--accent)' }}><Check size={11} /></button>
                        <button onClick={() => { setAddingTodoDay(null); setNewTodoTitle('') }} style={{ color: 'var(--text-dim)' }}><X size={11} /></button>
                      </div>
                    ) : (
                      <button
                        onClick={() => { setAddingTodoDay(dayKey); setNewTodoTitle('') }}
                        className="flex items-center gap-0.5 text-[10px] transition-colors mt-0.5 px-0.5"
                        style={{ color: 'var(--text-dim)' }}
                        onMouseEnter={e => (e.currentTarget.style.color = 'var(--accent)')}
                        onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-dim)')}
                      >
                        <Plus size={10} /><span>추가</span>
                      </button>
                    )}
                  </div>
                )}
              </div>
            )
          })}

          {/* ── Timeline separator ── */}
          <div
            style={{ gridColumn: '1 / -1', borderBottom: '1px solid var(--border-dim)', background: 'var(--bg-surface)' }}
            className="flex items-center gap-2 px-3 py-1"
          >
            <div className="w-1 h-1 rounded-full" style={{ background: 'var(--accent-dim)' }} />
            <span className="text-[9px] tracking-[0.2em] font-semibold uppercase" style={{ color: 'var(--text-dim)' }}>
              Timeline
            </span>
          </div>

          {/* ── Time labels ── */}
          <div style={{ position: 'relative', height: TOTAL_H, background: 'var(--bg-surface)', borderRight: '1px solid var(--border)' }}>
            {HOURS.map(hour => (
              <div
                key={hour}
                style={{ position: 'absolute', top: (hour - FIRST_HOUR) * ROW_H + 3, right: 6, color: 'var(--text-dim)' }}
                className="text-[10px] font-mono tabular-nums leading-none"
              >
                {String(hour).padStart(2, '0')}
              </div>
            ))}
          </div>

          {/* ── Day columns ── */}
          {weekDays.map((day, di) => {
            const dateKey = format(day, 'yyyy-MM-dd')
            const dayEntries = entriesForDay(day)
            const today = isToday(day)
            const isAddingHere = addingEntry?.dateKey === dateKey

            return (
              <div
                key={di}
                ref={el => { columnRefs.current[di] = el }}
                style={{
                  position: 'relative', height: TOTAL_H,
                  background: today ? 'rgba(199,137,40,0.04)' : 'var(--bg-surface)',
                  borderLeft: '1px solid var(--border)',
                }}
                className="paper-lines"
                onClick={e => {
                  if (isAddingHere || didDragRef.current) return
                  const rect = e.currentTarget.getBoundingClientRect()
                  const y = e.clientY - rect.top
                  const hour = Math.min(LAST_HOUR, FIRST_HOUR + Math.floor(y / ROW_H))
                  setAddingEntry({ dateKey, hour })
                  setNewEntry({ title: '', endTime: '', category: '' })
                }}
              >
                {/* Current time indicator */}
                {today && nowY !== null && (
                  <div
                    style={{ position: 'absolute', top: nowY, left: 0, right: 0, zIndex: 20 }}
                    className="pointer-events-none"
                  >
                    <div className="flex items-center">
                      <div
                        className="w-2 h-2 rounded-full flex-shrink-0 -ml-1"
                        style={{ background: 'var(--accent)', boxShadow: '0 0 6px var(--accent)' }}
                      />
                      <div className="flex-1 h-px" style={{ background: 'rgba(199,137,40,0.5)' }} />
                    </div>
                  </div>
                )}

                {/* Entries */}
                {dayEntries.map(entry => (
                  <EntryBlock
                    key={entry.id}
                    entry={entry}
                    onDelete={() => deleteEntry(entry.id)}
                    onDragStart={(e, type) => handleDragStart(e, entry, type)}
                  />
                ))}

                {/* Inline add form */}
                {isAddingHere && (
                  <div
                    style={{
                      position: 'absolute',
                      top: Math.max(0, (addingEntry!.hour - FIRST_HOUR) * ROW_H),
                      left: 3, right: 3, zIndex: 30,
                      background: 'var(--bg-card)',
                      border: '1px solid var(--accent-dim)',
                      borderRadius: 10,
                    }}
                    className="p-2 shadow-2xl"
                    onClick={e => e.stopPropagation()}
                  >
                    <input
                      type="text"
                      value={newEntry.title}
                      onChange={e => setNewEntry(p => ({ ...p, title: e.target.value }))}
                      onKeyDown={e => {
                        if (e.key === 'Enter') submitEntry(day, addingEntry!.hour)
                        if (e.key === 'Escape') setAddingEntry(null)
                      }}
                      placeholder={`${String(addingEntry!.hour).padStart(2, '0')}:00 내용...`}
                      className="w-full bg-transparent border-none text-[11px] focus:outline-none mb-1.5"
                      style={{ color: 'var(--text)' }}
                      autoFocus
                    />
                    <div className="flex gap-1">
                      <input
                        type="text"
                        value={newEntry.endTime}
                        onChange={e => setNewEntry(p => ({ ...p, endTime: e.target.value }))}
                        placeholder="~종료"
                        className="w-14 text-[10px] rounded px-1.5 py-0.5 focus:outline-none"
                        style={{ background: 'var(--bg-input)', border: '1px solid var(--border)', color: 'var(--text-muted)' }}
                      />
                      <select
                        value={newEntry.category}
                        onChange={e => setNewEntry(p => ({ ...p, category: e.target.value }))}
                        className="flex-1 text-[10px] rounded px-1 py-0.5 focus:outline-none"
                        style={{ background: 'var(--bg-input)', border: '1px solid var(--border)', color: 'var(--text-muted)' }}
                      >
                        <option value="">카테고리</option>
                        <option value="work">업무</option>
                        <option value="personal">개인</option>
                        <option value="exercise">운동</option>
                        <option value="study">학습</option>
                      </select>
                      <button onClick={() => submitEntry(day, addingEntry!.hour)} style={{ color: 'var(--accent)' }}>
                        <Check size={12} />
                      </button>
                      <button onClick={() => setAddingEntry(null)} style={{ color: 'var(--text-dim)' }}>
                        <X size={12} />
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
