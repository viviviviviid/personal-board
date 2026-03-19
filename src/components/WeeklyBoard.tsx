'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { format, addWeeks, subWeeks, startOfWeek, addDays, isSameDay, isToday } from 'date-fns'
import { ChevronLeft, ChevronRight, Plus, Check, X } from 'lucide-react'
import AIFeedback from './AIFeedback'

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
const FIRST_HOUR = 5
const LAST_HOUR = 23
const ROW_H = 52          // px per hour
const SNAP = 15           // snap to 15-min
const TOTAL_H = (LAST_HOUR - FIRST_HOUR + 1) * ROW_H
const HOURS = Array.from({ length: LAST_HOUR - FIRST_HOUR + 1 }, (_, i) => i + FIRST_HOUR)
const DAYS_KO = ['월', '화', '수', '목', '금', '토', '일']

const CAT_CLS: Record<string, string> = {
  work:     'bg-indigo-500/30 text-indigo-100 border-indigo-400/50',
  personal: 'bg-emerald-500/30 text-emerald-100 border-emerald-400/50',
  exercise: 'bg-orange-500/30 text-orange-100 border-orange-400/50',
  study:    'bg-blue-500/30 text-blue-100 border-blue-400/50',
}
const DEF_CLS = 'bg-[#2a2a50] text-[#c0c0e0] border-[#3a3a68]'

// ── Time helpers ───────────────────────────────────────────────────────────
function timeToY(time: string): number {
  const [h, m] = time.split(':').map(Number)
  return (h - FIRST_HOUR) * ROW_H + (m / 60) * ROW_H
}

function yToTime(y: number): string {
  const clamped = Math.max(0, Math.min(y, TOTAL_H - ROW_H / 4))
  const totalMin = clamped / ROW_H * 60
  const snapped = Math.round(totalMin / SNAP) * SNAP
  const h = FIRST_HOUR + Math.floor(snapped / 60)
  const m = snapped % 60
  const clampH = Math.min(LAST_HOUR, Math.max(FIRST_HOUR, h))
  return `${String(clampH).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}

function addOneHour(time: string): string {
  const [h, m] = time.split(':').map(Number)
  return `${String(Math.min(LAST_HOUR, h + 1)).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}

// ── Entry block component ──────────────────────────────────────────────────
interface EntryBlockProps {
  entry: TimelineEntry
  onDelete: () => void
  onDragStart: (e: React.MouseEvent, type: 'move' | 'resize') => void
}

function EntryBlock({ entry, onDelete, onDragStart }: EntryBlockProps) {
  const top = timeToY(entry.startTime)
  const effEnd = entry.endTime || addOneHour(entry.startTime)
  const height = Math.max(20, timeToY(effEnd) - top)
  const cls = CAT_CLS[entry.category || ''] ?? DEF_CLS

  return (
    <div
      style={{ position: 'absolute', top, left: 3, right: 3, height, zIndex: 10 }}
      className={`rounded border text-[10px] overflow-hidden group select-none ${cls}`}
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
        className="opacity-0 group-hover:opacity-100 hover:text-red-400 transition-opacity"
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
        <div className="w-8 h-[2px] rounded-full bg-current opacity-50" />
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

  const [addingTodoDay, setAddingTodoDay] = useState<string | null>(null)
  const [newTodoTitle, setNewTodoTitle] = useState('')

  const [addingEntry, setAddingEntry] = useState<{ dateKey: string; hour: number } | null>(null)
  const [newEntry, setNewEntry] = useState({ title: '', endTime: '', category: '' })

  // drag refs
  const dragRef = useRef<{
    type: 'move' | 'resize'
    entryId: string
    startMouseY: number
    startY: number
    durationPx: number
  } | null>(null)
  const didDragRef = useRef(false)  // suppresses click after drag
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

  // ── Todo handlers ────────────────────────────────────────────────────────
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

  // ── Timeline create ──────────────────────────────────────────────────────
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

    dragRef.current = {
      type, entryId: entry.id,
      startMouseY: e.clientY,
      startY, durationPx,
    }

    const onMove = (ev: MouseEvent) => {
      const drag = dragRef.current
      if (!drag) return
      const delta = ev.clientY - drag.startMouseY
      if (Math.abs(delta) > 3) didDragRef.current = true

      if (drag.type === 'move') {
        const newStartY = Math.max(0, drag.startY + delta)
        const newStartTime = yToTime(newStartY)
        const newEndTime = yToTime(newStartY + drag.durationPx)
        setTimeline(prev => prev.map(t =>
          t.id === drag.entryId ? { ...t, startTime: newStartTime, endTime: newEndTime } : t
        ))
      } else {
        const newDurPx = Math.max(ROW_H / 4, drag.durationPx + delta)
        const newEndTime = yToTime(drag.startY + newDurPx)
        setTimeline(prev => prev.map(t =>
          t.id === drag.entryId ? { ...t, endTime: newEndTime } : t
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
      // reset didDragRef after click event has fired
      setTimeout(() => { didDragRef.current = false }, 0)

      // save to API using ref to get latest state
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

  // ── Render ────────────────────────────────────────────────────────────────
  const gridCols = `44px repeat(7, minmax(0, 1fr))`

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>

      {/* Header */}
      <div className="flex items-center justify-between mb-4 flex-shrink-0">
        <div>
          <h1 className="text-lg font-bold text-[#e8e8f8]">주간 보드</h1>
          <p className="text-xs text-[#7070a8] mt-0.5">{weekLabel}</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setCurrentWeekStart(d => subWeeks(d, 1))}
            className="p-1.5 bg-[#1c1c3a] border border-[#28285a] rounded-lg hover:border-indigo-500/50 text-[#8888bb] hover:text-[#ccccee] transition-all">
            <ChevronLeft size={16} />
          </button>
          <button onClick={() => setCurrentWeekStart(startOfWeek(new Date(), { weekStartsOn: 1 }))}
            className="px-2.5 py-1 text-xs bg-[#1c1c3a] border border-[#28285a] rounded-lg hover:border-indigo-500/50 text-[#8888bb] hover:text-[#ccccee] transition-all">
            이번 주
          </button>
          <button onClick={() => setCurrentWeekStart(d => addWeeks(d, 1))}
            className="p-1.5 bg-[#1c1c3a] border border-[#28285a] rounded-lg hover:border-indigo-500/50 text-[#8888bb] hover:text-[#ccccee] transition-all">
            <ChevronRight size={16} />
          </button>
          <AIFeedback weekStart={currentWeekStart} />
        </div>
      </div>

      {error && (
        <div className="mb-3 p-2 bg-red-500/10 border border-red-500/20 rounded-lg text-xs text-red-400 flex-shrink-0">
          {error}
        </div>
      )}

      {/* Grid */}
      <div className="flex-1 overflow-auto rounded-xl border border-[#28285a]" style={{ minWidth: 0 }}>
        <div style={{ display: 'grid', gridTemplateColumns: gridCols, minWidth: '760px' }}>

          {/* ── Day headers (sticky) ── */}
          <div className="sticky top-0 z-30 bg-[#1c1c3a] border-b border-[#28285a]" />
          {weekDays.map((day, i) => {
            const today = isToday(day)
            return (
              <div key={i}
                className={`sticky top-0 z-30 border-l border-b border-[#28285a] px-2 py-2 ${today ? 'bg-indigo-900/40' : 'bg-[#1c1c3a]'}`}>
                <div className={`text-[10px] font-medium ${today ? 'text-indigo-400' : i >= 5 ? 'text-rose-400/80' : 'text-[#7070a8]'}`}>
                  {DAYS_KO[i]}
                </div>
                <div className={`text-xl font-bold leading-tight ${today ? 'text-indigo-300' : 'text-[#ddddf5]'}`}>
                  {format(day, 'd')}
                </div>
                <div className="text-[9px] text-[#5050a0]">{format(day, 'MM/dd')}</div>
              </div>
            )
          })}

          {/* ── To-do section ── */}
          <div className="bg-[#191932] border-b border-[#28285a] flex items-start justify-end pr-1.5 pt-2">
            <span className="text-[9px] text-[#5050a0] tracking-wider">To-do</span>
          </div>
          {weekDays.map((day, i) => {
            const dayKey = format(day, 'yyyy-MM-dd')
            const dayTodos = todosForDay(day)
            const isAdding = addingTodoDay === dayKey
            const today = isToday(day)
            return (
              <div key={i}
                className={`border-l border-b border-[#28285a] p-1.5 ${today ? 'bg-indigo-500/[0.10]' : 'bg-[#191932]'}`}
                style={{ minHeight: 80 }}>
                {loading ? (
                  <div className="text-[10px] text-gray-700 text-center pt-5">···</div>
                ) : (
                  <div className="space-y-0.5">
                    {dayTodos.map(todo => (
                      <div key={todo.id}
                        className="flex items-start gap-1 group px-0.5 py-0.5 rounded hover:bg-white/[0.04] transition-colors">
                        <button onClick={() => toggleTodo(todo.id, todo.completed)}
                          className={`mt-[2px] w-3.5 h-3.5 rounded-sm border flex-shrink-0 flex items-center justify-center transition-all ${todo.completed ? 'bg-indigo-600 border-indigo-600' : 'border-[#3a3a6a] hover:border-indigo-400/60'}`}>
                          {todo.completed && <Check size={8} className="text-white" />}
                        </button>
                        <span className={`text-[11px] leading-4 flex-1 min-w-0 break-words ${todo.completed ? 'line-through text-[#5050a0]' : 'text-[#d0d0f0]'}`}>
                          {todo.title}
                        </span>
                        <button onClick={() => deleteTodo(todo.id)}
                          className="opacity-0 group-hover:opacity-100 text-[#5050a0] hover:text-red-400 transition-all flex-shrink-0 mt-[2px]">
                          <X size={9} />
                        </button>
                      </div>
                    ))}
                    {isAdding ? (
                      <div className="flex items-center gap-1 pt-0.5">
                        <input type="text" value={newTodoTitle}
                          onChange={e => setNewTodoTitle(e.target.value)}
                          onKeyDown={e => {
                            if (e.key === 'Enter') submitTodo(day)
                            if (e.key === 'Escape') { setAddingTodoDay(null); setNewTodoTitle('') }
                          }}
                          placeholder="할일..."
                          className="flex-1 min-w-0 bg-[#242450] border border-indigo-500/30 rounded px-1.5 py-0.5 text-[11px] text-[#ddddf5] placeholder-[#4040a0] focus:outline-none"
                          autoFocus />
                        <button onClick={() => submitTodo(day)} className="text-indigo-400 hover:text-indigo-300 flex-shrink-0"><Check size={11} /></button>
                        <button onClick={() => { setAddingTodoDay(null); setNewTodoTitle('') }} className="text-[#5050a0] hover:text-gray-400 flex-shrink-0"><X size={11} /></button>
                      </div>
                    ) : (
                      <button onClick={() => { setAddingTodoDay(dayKey); setNewTodoTitle('') }}
                        className="flex items-center gap-0.5 text-[10px] text-gray-700 hover:text-indigo-400 transition-colors mt-0.5 px-0.5">
                        <Plus size={10} /><span>추가</span>
                      </button>
                    )}
                  </div>
                )}
              </div>
            )
          })}

          {/* ── Timeline separator ── */}
          <div style={{ gridColumn: '1 / -1' }}
            className="flex items-center gap-2 bg-[#14142e] border-b border-[#252532] px-3 py-1">
            <div className="w-1 h-1 rounded-full bg-indigo-500/50" />
            <span className="text-[9px] text-[#5050a0] tracking-[0.2em] uppercase">타임라인</span>
          </div>

          {/* ── Timeline body ── */}
          {/* Time labels */}
          <div style={{ position: 'relative', height: TOTAL_H }} className="bg-[#14142e] border-r border-[#28285a]">
            {HOURS.map(hour => (
              <div key={hour}
                style={{ position: 'absolute', top: (hour - FIRST_HOUR) * ROW_H + 3, right: 6 }}
                className="text-[10px] text-[#5050a0] font-mono tabular-nums leading-none">
                {String(hour).padStart(2, '0')}
              </div>
            ))}
          </div>

          {/* Day columns */}
          {weekDays.map((day, di) => {
            const dateKey = format(day, 'yyyy-MM-dd')
            const dayEntries = entriesForDay(day)
            const today = isToday(day)
            const isAddingHere = addingEntry?.dateKey === dateKey

            return (
              <div key={di}
                ref={el => { columnRefs.current[di] = el }}
                style={{ position: 'relative', height: TOTAL_H }}
                className={`border-l border-[#28285a] ${today ? 'bg-indigo-500/[0.07]' : 'bg-[#14142e]'}`}
                onClick={e => {
                  if (isAddingHere || didDragRef.current) return
                  const rect = e.currentTarget.getBoundingClientRect()
                  const y = e.clientY - rect.top
                  const hour = Math.min(LAST_HOUR, FIRST_HOUR + Math.floor(y / ROW_H))
                  setAddingEntry({ dateKey, hour })
                  setNewEntry({ title: '', endTime: '', category: '' })
                }}
              >
                {/* Hour grid lines */}
                {HOURS.map(hour => (
                  <div key={hour}
                    style={{ position: 'absolute', top: (hour - FIRST_HOUR) * ROW_H, left: 0, right: 0, height: ROW_H }}
                    className="border-b border-[#222248] pointer-events-none"
                  >
                    {/* half-hour line */}
                    <div style={{ position: 'absolute', top: ROW_H / 2, left: 0, right: 0 }}
                      className="border-b border-[#1c1c38] pointer-events-none" />
                  </div>
                ))}

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
                    }}
                    className="bg-[#1e1e42] border border-indigo-500/40 rounded-lg p-2 shadow-xl"
                    onClick={e => e.stopPropagation()}
                  >
                    <input type="text" value={newEntry.title}
                      onChange={e => setNewEntry(p => ({ ...p, title: e.target.value }))}
                      onKeyDown={e => {
                        if (e.key === 'Enter') submitEntry(day, addingEntry!.hour)
                        if (e.key === 'Escape') setAddingEntry(null)
                      }}
                      placeholder={`${String(addingEntry!.hour).padStart(2, '0')}:00 내용...`}
                      className="w-full bg-transparent border-none text-[11px] text-[#ddddf5] placeholder-[#4040a0] focus:outline-none mb-1.5"
                      autoFocus />
                    <div className="flex gap-1">
                      <input type="text" value={newEntry.endTime}
                        onChange={e => setNewEntry(p => ({ ...p, endTime: e.target.value }))}
                        placeholder="~종료"
                        className="w-14 bg-[#252548] border border-[#28285a] rounded px-1.5 py-0.5 text-[10px] text-gray-400 placeholder-[#4040a0] focus:outline-none" />
                      <select value={newEntry.category}
                        onChange={e => setNewEntry(p => ({ ...p, category: e.target.value }))}
                        className="flex-1 bg-[#252548] border border-[#28285a] rounded px-1 py-0.5 text-[10px] text-gray-400 focus:outline-none">
                        <option value="">카테고리</option>
                        <option value="work">업무</option>
                        <option value="personal">개인</option>
                        <option value="exercise">운동</option>
                        <option value="study">학습</option>
                      </select>
                      <button onClick={() => submitEntry(day, addingEntry!.hour)} className="text-indigo-400 hover:text-indigo-300 flex-shrink-0">
                        <Check size={12} />
                      </button>
                      <button onClick={() => setAddingEntry(null)} className="text-[#5050a0] hover:text-gray-400 flex-shrink-0">
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
