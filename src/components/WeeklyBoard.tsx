'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { format, addWeeks, subWeeks, startOfWeek, addDays, isSameDay, isToday, addMonths, subMonths, startOfMonth } from 'date-fns'
import { ChevronLeft, ChevronRight, Plus, Check, X, CalendarDays } from 'lucide-react'
import AIFeedback from './AIFeedback'
import MonthlyCalendar from './MonthlyCalendar'
import {
  FIRST_HOUR, LAST_HOUR, ROW_H, SNAP, TOTAL_H,
  timeToY, yToTime, addOneHour, nowToY,
} from '@/lib/timeUtils'

// ── Types ──────────────────────────────────────────────────────────────────
interface GoogleCalendar {
  id: string
  summary: string
  backgroundColor: string
  primary?: boolean
}

interface GoogleCalendarEvent {
  id: string
  summary?: string
  start: { dateTime: string }
  end: { dateTime: string }
  calendarId: string
  calendarColor: string
}

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

// Obsidian category colors
const CAT_STYLE: Record<string, { bg: string; text: string; border: string }> = {
  work: { bg: 'rgba(139, 92, 246, 0.25)', text: '#A78BFA', border: 'rgba(139, 92, 246, 0.5)' },
  personal: { bg: 'rgba(16, 185, 129, 0.25)', text: '#34D399', border: 'rgba(16, 185, 129, 0.5)' },
  exercise: { bg: 'rgba(245, 158, 11, 0.25)', text: '#FBBF24', border: 'rgba(245, 158, 11, 0.5)' },
  study: { bg: 'rgba(59, 130, 246, 0.25)', text: '#60A5FA', border: 'rgba(59, 130, 246, 0.5)' },
}
const DEF_STYLE = { bg: 'var(--bg-hover)', text: 'var(--text-muted)', border: 'var(--border)' }

const PRIORITY_COLOR: Record<string, string> = {
  high: '#EF4444',
  medium: '#F59E0B',
  low: '#A1A1AA',
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

// ── Google Event block ──────────────────────────────────────────────────────
function GoogleEventBlock({ event }: { event: GoogleCalendarEvent }) {
  const startTime = format(new Date(event.start.dateTime), 'HH:mm')
  const endTime = format(new Date(event.end.dateTime), 'HH:mm')
  const top = timeToY(startTime)
  const height = Math.max(20, timeToY(endTime) - top)
  const color = event.calendarColor ?? '#4285F4'

  return (
    <div
      style={{
        position: 'absolute', top, left: 3, right: 3, height, zIndex: 9,
        background: `${color}33`,
        border: `1px solid ${color}88`,
        color,
        borderRadius: 6,
        pointerEvents: 'none',
      }}
      className="text-[10px] overflow-hidden"
    >
      <div className="px-1.5 pt-0.5 h-full overflow-hidden">
        <div className="font-mono text-[9px] opacity-55 tabular-nums leading-none">
          {startTime} – {endTime}
        </div>
        <div className="mt-0.5 leading-tight font-medium truncate flex items-center gap-1">
          <span className="text-[8px] font-bold opacity-70">G</span>
          {event.summary ?? '(제목 없음)'}
        </div>
      </div>
    </div>
  )
}

// ── Main component ─────────────────────────────────────────────────────────
export default function WeeklyBoard() {
  const [view, setView] = useState<'weekly' | 'monthly'>('weekly')
  const [currentWeekStart, setCurrentWeekStart] = useState(() =>
    startOfWeek(new Date(), { weekStartsOn: 1 })
  )
  const [currentMonth, setCurrentMonth] = useState(() => startOfMonth(new Date()))
  const [monthCount, setMonthCount] = useState<1 | 2 | 3>(1)
  const [todos, setTodos] = useState<Todo[]>([])
  const [timeline, setTimeline] = useState<TimelineEntry[]>([])
  const [googleEvents, setGoogleEvents] = useState<GoogleCalendarEvent[]>([])
  const [calendarList, setCalendarList] = useState<GoogleCalendar[]>([])
  const [enabledCalendars, setEnabledCalendars] = useState<Set<string>>(new Set())
  const [calPanelOpen, setCalPanelOpen] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [now, setNow] = useState(new Date())

  const [addingTodoDay, setAddingTodoDay] = useState<string | null>(null)
  const [newTodoTitle, setNewTodoTitle] = useState('')
  const [addingEntry, setAddingEntry] = useState<{ dateKey: string; hour: number } | null>(null)
  const [newEntry, setNewEntry] = useState({ title: '', endTime: '', category: '' })

  // Google Calendar 목록 fetch
  useEffect(() => {
    fetch('/api/google-calendar/list')
      .then(r => r.ok ? r.json() : { calendars: [] })
      .then(data => {
        const cals: GoogleCalendar[] = data.calendars ?? []
        setCalendarList(cals)
        // localStorage에서 활성화된 캘린더 복원, 없으면 전체 활성화
        const saved = localStorage.getItem('enabled-calendars')
        if (saved) {
          setEnabledCalendars(new Set(JSON.parse(saved)))
        } else {
          setEnabledCalendars(new Set(cals.map(c => c.id)))
        }
      })
      .catch(() => {})
  }, [])

  // 패널 외부 클릭 시 닫기
  useEffect(() => {
    if (!calPanelOpen) return
    const handler = (e: MouseEvent) => {
      const target = e.target as HTMLElement
      if (!target.closest('[data-cal-panel]')) setCalPanelOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [calPanelOpen])

  const toggleCalendar = (calId: string) => {
    setEnabledCalendars(prev => {
      const next = new Set(prev)
      if (next.has(calId)) next.delete(calId)
      else next.add(calId)
      localStorage.setItem('enabled-calendars', JSON.stringify([...next]))
      return next
    })
  }

  // Persist monthCount
  useEffect(() => {
    const saved = localStorage.getItem('board-month-count')
    if (saved === '1' || saved === '2' || saved === '3') {
      setMonthCount(Number(saved) as 1 | 2 | 3)
    }
  }, [])

  const setMonthCountPersist = (n: 1 | 2 | 3) => {
    setMonthCount(n)
    localStorage.setItem('board-month-count', String(n))
  }

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
      const timeMin = currentWeekStart.toISOString()
      const timeMax = addDays(currentWeekStart, 7).toISOString()

      const gcPromise = enabledCalendars.size > 0
        ? (() => {
            const ids = [...enabledCalendars]
            const colors = ids.map(id => calendarList.find(c => c.id === id)?.backgroundColor ?? '#4285F4')
            return fetch(
              `/api/google-calendar?timeMin=${timeMin}&timeMax=${timeMax}&calendarIds=${ids.map(encodeURIComponent).join(',')}&calendarColors=${colors.map(encodeURIComponent).join(',')}`
            )
          })()
        : Promise.resolve(null)

      const [tr, tl, gc] = await Promise.all([
        fetch(`/api/todos?week=${wp}`),
        fetch(`/api/timeline?week=${wp}`),
        gcPromise,
      ])
      if (tr.ok) setTodos(await tr.json())
      if (tl.ok) setTimeline(await tl.json())
      if (gc && gc.ok) {
        const gcData = await gc.json()
        setGoogleEvents(gcData.events ?? [])
      } else if (!gc) {
        setGoogleEvents([])
      }
      setError(null)
    } catch {
      setError('데이터를 불러올 수 없습니다.')
    } finally {
      setLoading(false)
    }
  }, [currentWeekStart, enabledCalendars, calendarList])

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
  const googleEventsForDay = (day: Date) =>
    googleEvents.filter(e => isSameDay(new Date(e.start.dateTime), day))
  const weekLabel = `${format(currentWeekStart, 'yyyy.MM.dd')} — ${format(addDays(currentWeekStart, 6), 'MM.dd')}`
  const monthLabel = monthCount === 1
    ? format(currentMonth, 'yyyy년 M월')
    : `${format(currentMonth, 'yyyy.MM')} — ${format(addMonths(currentMonth, monthCount - 1), 'yyyy.MM')}`
  const nowY = nowToY(now)
  const gridCols = `44px repeat(7, minmax(0, 1fr))`

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>

      {/* Header */}
      <div className="flex items-center justify-between mb-4 flex-shrink-0">
        <div>
          <h1 className="text-lg font-bold" style={{ color: 'var(--text-bright)' }}>
            {view === 'weekly' ? '주간 보드' : '월간 캘린더'}
          </h1>
          <p className="text-xs mt-0.5" style={{ color: 'var(--text-dim)' }}>
            {view === 'weekly' ? weekLabel : monthLabel}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {/* View toggle */}
          <div
            className="flex rounded-lg overflow-hidden"
            style={{ border: '1px solid var(--border)' }}
          >
            {(['weekly', 'monthly'] as const).map((v, i) => (
              <button
                key={v}
                onClick={() => setView(v)}
                className="px-2.5 py-1 text-xs transition-all"
                style={{
                  background: view === v ? 'var(--accent-dim)' : 'var(--bg-card)',
                  color: view === v ? 'var(--accent-light)' : 'var(--text-muted)',
                  borderRight: i === 0 ? '1px solid var(--border)' : 'none',
                }}
              >
                {v === 'weekly' ? '주간' : '월간'}
              </button>
            ))}
          </div>

          {view === 'weekly' ? (
            <>
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
              {/* Google Calendar 토글 버튼 */}
              {calendarList.length > 0 && (
                <div style={{ position: 'relative' }} data-cal-panel>
                  <button
                    onClick={() => setCalPanelOpen(v => !v)}
                    className="p-1.5 rounded-lg transition-all flex items-center gap-1.5"
                    style={{
                      background: calPanelOpen ? 'var(--accent-dim)' : 'var(--bg-card)',
                      border: `1px solid ${calPanelOpen ? 'var(--accent)' : 'var(--border)'}`,
                      color: calPanelOpen ? 'var(--accent-light)' : 'var(--text-muted)',
                    }}
                    title="Google Calendar"
                  >
                    <CalendarDays size={14} />
                    {enabledCalendars.size < calendarList.length && (
                      <span className="text-[10px] font-bold">
                        {enabledCalendars.size}/{calendarList.length}
                      </span>
                    )}
                  </button>

                  {calPanelOpen && (
                    <div
                      style={{
                        position: 'absolute', top: '100%', right: 0, marginTop: 6,
                        background: 'var(--bg-surface)',
                        border: '1px solid var(--border)',
                        borderRadius: 12, padding: '8px 4px',
                        minWidth: 220, zIndex: 100,
                        boxShadow: '0 4px 20px rgba(0,0,0,0.3)',
                      }}
                    >
                      <div className="px-3 pb-1.5" style={{ borderBottom: '1px solid var(--border-dim)', marginBottom: 4 }}>
                        <span className="text-[10px] font-semibold tracking-wide" style={{ color: 'var(--text-dim)' }}>
                          GOOGLE CALENDAR
                        </span>
                      </div>
                      {calendarList.map(cal => (
                        <button
                          key={cal.id}
                          onClick={() => toggleCalendar(cal.id)}
                          className="w-full flex items-center gap-2.5 px-3 py-1.5 rounded-lg transition-all text-left"
                          style={{ background: 'transparent' }}
                          onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-hover)')}
                          onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                        >
                          <div
                            style={{
                              width: 10, height: 10, borderRadius: '50%', flexShrink: 0,
                              background: enabledCalendars.has(cal.id) ? cal.backgroundColor : 'transparent',
                              border: `2px solid ${cal.backgroundColor}`,
                              transition: 'background 0.15s',
                            }}
                          />
                          <span
                            className="text-[12px] truncate flex-1"
                            style={{ color: enabledCalendars.has(cal.id) ? 'var(--text)' : 'var(--text-dim)' }}
                          >
                            {cal.summary}
                            {cal.primary && (
                              <span className="ml-1 text-[9px]" style={{ color: 'var(--text-dim)' }}>기본</span>
                            )}
                          </span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
              <AIFeedback weekStart={currentWeekStart} />
            </>
          ) : (
            <>
              {/* Month count selector */}
              <div
                className="flex rounded-lg overflow-hidden"
                style={{ border: '1px solid var(--border)' }}
              >
                {([1, 2, 3] as const).map((n, i) => (
                  <button
                    key={n}
                    onClick={() => setMonthCountPersist(n)}
                    className="px-2 py-1 text-xs transition-all"
                    style={{
                      background: monthCount === n ? 'var(--accent-dim)' : 'var(--bg-card)',
                      color: monthCount === n ? 'var(--accent-light)' : 'var(--text-muted)',
                      borderRight: i < 2 ? '1px solid var(--border)' : 'none',
                    }}
                  >
                    {n}개월
                  </button>
                ))}
              </div>
              <button
                onClick={() => setCurrentMonth(d => subMonths(d, 1))}
                className="p-1.5 rounded-lg transition-all"
                style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', color: 'var(--text-muted)' }}
              >
                <ChevronLeft size={15} />
              </button>
              <button
                onClick={() => setCurrentMonth(startOfMonth(new Date()))}
                className="px-2.5 py-1 text-xs rounded-lg transition-all"
                style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', color: 'var(--text-muted)' }}
              >
                이번 달
              </button>
              <button
                onClick={() => setCurrentMonth(d => addMonths(d, 1))}
                className="p-1.5 rounded-lg transition-all"
                style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', color: 'var(--text-muted)' }}
              >
                <ChevronRight size={15} />
              </button>
            </>
          )}
        </div>
      </div>

      {view === 'monthly' && (
        <MonthlyCalendar currentMonth={currentMonth} monthCount={monthCount} />
      )}

      {view === 'weekly' && error && (
        <div
          className="mb-3 p-2 rounded-lg text-xs flex-shrink-0"
          style={{ background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.3)', color: 'var(--danger)' }}
        >
          {error}
        </div>
      )}

      {/* Grid */}
      {view === 'weekly' && <div
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
                  background: today ? 'rgba(139, 92, 246, 0.08)' : 'var(--bg-surface)',
                  borderLeft: '1px solid var(--border)',
                  borderBottom: '1px solid var(--border)',
                }}
              >
                <div
                  className="text-[11px] font-semibold tracking-wide"
                  style={{ color: today ? 'var(--accent)' : i >= 5 ? 'var(--text-muted)' : 'var(--text-dim)' }}
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
                  background: today ? 'rgba(139, 92, 246, 0.05)' : 'var(--bg-card)',
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
            const dayGoogleEvents = googleEventsForDay(day)
            const today = isToday(day)
            const isAddingHere = addingEntry?.dateKey === dateKey

            return (
              <div
                key={di}
                ref={el => { columnRefs.current[di] = el }}
                style={{
                  position: 'relative', height: TOTAL_H,
                  background: today ? 'rgba(139, 92, 246, 0.04)' : 'var(--bg-surface)',
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
                      <div className="flex-1 h-px" style={{ background: 'rgba(139, 92, 246, 0.5)' }} />
                    </div>
                  </div>
                )}

                {/* Google Calendar Events */}
                {dayGoogleEvents.map(event => (
                  <GoogleEventBlock key={event.id} event={event} />
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
                      background: 'var(--bg-card)',
                      border: '1px solid var(--accent-dim)',
                      borderRadius: 10,
                    }}
                    className="p-2"
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
      </div>}
    </div>
  )
}
