'use client'

import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import {
  format, addMonths, startOfMonth, endOfMonth,
  startOfWeek, endOfWeek, addDays, isSameDay, isToday, isSameMonth,
} from 'date-fns'

// ── Types ──────────────────────────────────────────────────────────────────
interface TimelineEntry {
  id: string
  title: string
  date: string
  startTime: string
  endTime: string | null
  category: string | null
  hideFromMonthly: boolean
}

interface Todo {
  id: string
  title: string
  completed: boolean
  priority: string
  date: string | null
}

interface CalEvent {
  id: string
  summary?: string
  start: { dateTime?: string; date?: string }
  end: { dateTime?: string; date?: string }
  calendarId: string
  calendarColor: string
  allDay?: boolean
}

interface CalendarItem {
  id: string
  backgroundColor: string
  summary: string
}

// ── Constants ──────────────────────────────────────────────────────────────
const DAYS_KO = ['월', '화', '수', '목', '금', '토', '일']
const PRIORITY_COLOR: Record<string, string> = {
  high: '#EF4444',
  medium: '#F59E0B',
  low: '#A1A1AA',
}
const CAT_COLOR: Record<string, string> = {
  work: '#6366f1', personal: '#ec4899', exercise: '#10b981',
  study: '#f59e0b', health: '#14b8a6', other: '#8b5cf6',
}
const HEADER_H = 58

// ── Props ──────────────────────────────────────────────────────────────────
interface Props {
  currentMonth: Date
  monthCount: 1 | 2 | 3
  enabledCalendars?: Set<string>
  calendarList?: CalendarItem[]
  onDateSelect?: (date: Date) => void
}

// ── Main component ─────────────────────────────────────────────────────────
export default function MonthlyCalendar({ currentMonth, monthCount, enabledCalendars, calendarList, onDateSelect }: Props) {
  const [todos, setTodos] = useState<Todo[]>([])
  const [timeline, setTimeline] = useState<TimelineEntry[]>([])
  const [calEvents, setCalEvents] = useState<CalEvent[]>([])
  const [loading, setLoading] = useState(true)
  const [cellSize, setCellSize] = useState(80)
  const [containerWidth, setContainerWidth] = useState(800)
  const containerRef = useRef<HTMLDivElement>(null)

  const months = useMemo(
    () => Array.from({ length: monthCount }, (_, i) => addMonths(currentMonth, i)),
    [currentMonth, monthCount],
  )

  const maxNumWeeks = useMemo(() => {
    return Math.max(...months.map(m => {
      const s = startOfWeek(startOfMonth(m), { weekStartsOn: 1 })
      const e = endOfWeek(endOfMonth(m), { weekStartsOn: 1 })
      let n = 0, cur = s
      while (cur <= e) { n++; cur = addDays(cur, 1) }
      return n / 7
    }))
  }, [months])

  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const obs = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect
      setContainerWidth(width)
      const perMonthW = (width - (monthCount - 1) * 12) / monthCount
      const fromW = Math.floor(perMonthW / 7)
      const fromH = Math.floor((height - HEADER_H) / maxNumWeeks)
      setCellSize(Math.max(36, Math.min(fromW, fromH)))
    })
    obs.observe(el)
    return () => obs.disconnect()
  }, [monthCount, maxNumWeeks])

  const fetchTodos = useCallback(async () => {
    setLoading(true)
    try {
      const startDate = format(currentMonth, 'yyyy-MM-dd')
      const endDate = format(endOfMonth(addMonths(currentMonth, monthCount - 1)), 'yyyy-MM-dd')
      const [todosRes, timelineRes] = await Promise.all([
        fetch(`/api/todos?startDate=${startDate}&endDate=${endDate}`),
        fetch(`/api/timeline?startDate=${startDate}&endDate=${endDate}`),
      ])
      if (todosRes.ok) setTodos(await todosRes.json())
      if (timelineRes.ok) setTimeline(await timelineRes.json())
    } catch {
      // ignore
    } finally {
      setLoading(false)
    }
  }, [currentMonth, monthCount])

  const fetchCalEvents = useCallback(async () => {
    if (!enabledCalendars || enabledCalendars.size === 0) {
      setCalEvents([])
      return
    }
    const ids = [...enabledCalendars]
    const colors = ids.map(id => calendarList?.find(c => c.id === id)?.backgroundColor ?? '#4285F4')
    const timeMin = startOfMonth(currentMonth).toISOString()
    const timeMax = endOfMonth(addMonths(currentMonth, monthCount - 1)).toISOString()

    try {
      const res = await fetch(
        `/api/google-calendar?timeMin=${encodeURIComponent(timeMin)}&timeMax=${encodeURIComponent(timeMax)}&calendarIds=${ids.map(encodeURIComponent).join(',')}&calendarColors=${colors.map(encodeURIComponent).join(',')}`
      )
      if (res.ok) {
        const data = await res.json()
        setCalEvents(data.events ?? [])
      }
    } catch {
      // ignore
    }
  }, [enabledCalendars, calendarList, currentMonth, monthCount])

  useEffect(() => { fetchTodos() }, [fetchTodos])
  useEffect(() => { fetchCalEvents() }, [fetchCalEvents])

  const todosForDay = (day: Date) =>
    todos.filter(t => t.date && isSameDay(new Date(t.date), day))
  const timelineForDay = (day: Date) =>
    timeline.filter(e => !e.hideFromMonthly && isSameDay(new Date(e.date), day))
  const calEventsForDay = (day: Date) => {
    const dayStr = format(day, 'yyyy-MM-dd')
    return calEvents.filter(e => {
      if (e.allDay) {
        // 종일 이벤트: end.date는 exclusive (Google Calendar 규칙)
        return !!e.start.date && !!e.end.date && e.start.date <= dayStr && dayStr < e.end.date
      }
      // 시간 지정 이벤트: 해당 날짜와 겹치는지 확인
      if (!e.start.dateTime) return false
      const startDay = format(new Date(e.start.dateTime), 'yyyy-MM-dd')
      const endDt = new Date(e.end.dateTime!)
      const endDay = endDt.getHours() === 0 && endDt.getMinutes() === 0
        ? format(addDays(endDt, -1), 'yyyy-MM-dd')
        : format(endDt, 'yyyy-MM-dd')
      return startDay <= dayStr && dayStr <= endDay
    })
  }

  return (
    <div
      ref={containerRef}
      style={{
        flex: 1,
        minHeight: 0,
        overflow: 'hidden',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'flex-start',
        gap: 12,
      }}
    >
      {months.map((month, mi) => (
        <MonthGrid
          key={mi}
          month={month}
          cellSize={cellSize}
          containerWidth={containerWidth}
          todosForDay={todosForDay}
          timelineForDay={timelineForDay}
          calEventsForDay={calEventsForDay}
          loading={loading}
          onRefresh={fetchTodos}
          onDateSelect={onDateSelect}
        />
      ))}
    </div>
  )
}

// ── Month grid ─────────────────────────────────────────────────────────────
function MonthGrid({
  month,
  cellSize,
  containerWidth,
  todosForDay,
  timelineForDay,
  calEventsForDay,
  loading,
  onRefresh,
  onDateSelect,
}: {
  month: Date
  cellSize: number
  containerWidth: number
  todosForDay: (day: Date) => Todo[]
  timelineForDay: (day: Date) => TimelineEntry[]
  calEventsForDay: (day: Date) => CalEvent[]
  loading: boolean
  onRefresh: () => void
  onDateSelect?: (date: Date) => void
}) {
  const monthStart = startOfMonth(month)
  const monthEnd = endOfMonth(month)
  const calStart = startOfWeek(monthStart, { weekStartsOn: 1 })
  const calEnd = endOfWeek(monthEnd, { weekStartsOn: 1 })

  const [addingDay, setAddingDay] = useState<string | null>(null)
  const [newTitle, setNewTitle] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (addingDay) inputRef.current?.focus()
  }, [addingDay])

  const handleAddSubmit = async (day: Date) => {
    const title = newTitle.trim()
    setAddingDay(null)
    setNewTitle('')
    if (!title) return
    try {
      await fetch('/api/todos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, date: format(day, 'yyyy-MM-dd') }),
      })
      onRefresh()
    } catch {
      // ignore
    }
  }

  const days: Date[] = []
  let cur = calStart
  while (cur <= calEnd) {
    days.push(cur)
    cur = addDays(cur, 1)
  }
  const numWeeks = days.length / 7
  const gridWidth = cellSize * 7

  const pad = Math.max(2, Math.round(cellSize * 0.05))
  const dateFontSize = Math.max(9, Math.min(13, Math.round(cellSize * 0.19)))
  const dateCircle = Math.max(16, Math.min(22, Math.round(cellSize * 0.31)))
  const todoFont = Math.max(8, Math.min(11, Math.round(cellSize * 0.14)))
  const dot = Math.max(4, Math.min(6, Math.round(cellSize * 0.08)))
  const isMobile = containerWidth < 640 || cellSize < 60
  const maxVisible = isMobile ? 0 : 3

  return (
    <div
      style={{
        flexShrink: 0,
        width: gridWidth,
        border: '1px solid var(--border)',
        borderRadius: 12,
        overflow: 'hidden',
      }}
    >
      {/* Month title */}
      <div style={{ background: 'var(--bg-surface)', borderBottom: '1px solid var(--border)', padding: '6px 10px' }}>
        <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-bright)' }}>
          {format(month, 'yyyy년 M월')}
        </span>
      </div>

      {/* Day-of-week header */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: `repeat(7, ${cellSize}px)`,
          borderBottom: '1px solid var(--border)',
          background: 'var(--bg-surface)',
        }}
      >
        {DAYS_KO.map((d, i) => (
          <div
            key={i}
            style={{
              textAlign: 'center', padding: '4px 0', fontSize: 10,
              fontWeight: 600, letterSpacing: '0.04em',
              color: i >= 5 ? 'var(--text-muted)' : 'var(--text-dim)',
            }}
          >
            {d}
          </div>
        ))}
      </div>

      {/* Day cells */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: `repeat(7, ${cellSize}px)`,
          gridTemplateRows: `repeat(${numWeeks}, ${cellSize}px)`,
        }}
      >
        {days.map((day, i) => {
          const inMonth = isSameMonth(day, month)
          const today = isToday(day)
          const dayTodos = inMonth && !loading ? todosForDay(day) : []
          const dayTimeline = inMonth && !loading ? timelineForDay(day) : []
          const dayCalEvents = inMonth && !loading ? calEventsForDay(day) : []
          const dayKey = format(day, 'yyyy-MM-dd')
          const isAdding = addingDay === dayKey

          // 셀에 표시할 항목 수 계산
          const todosVisible = dayTodos.slice(0, maxVisible)
          let slotsLeft = Math.max(0, maxVisible - todosVisible.length)
          const timelineVisible = dayTimeline.slice(0, slotsLeft)
          slotsLeft = Math.max(0, slotsLeft - timelineVisible.length)
          const calVisible = dayCalEvents.slice(0, slotsLeft)
          const overflow = (dayTodos.length - todosVisible.length) + (dayTimeline.length - timelineVisible.length) + (dayCalEvents.length - calVisible.length)

          return (
            <div
              key={i}
              onClick={() => { if (inMonth && !isAdding) { onDateSelect?.(day); setAddingDay(dayKey); setNewTitle('') } }}
              style={{
                background: today ? 'rgba(139, 92, 246, 0.06)' : inMonth ? 'var(--bg-card)' : 'var(--bg-surface)',
                borderRight: (i + 1) % 7 !== 0 ? '1px solid var(--border)' : 'none',
                borderBottom: i < days.length - 7 ? '1px solid var(--border)' : 'none',
                opacity: inMonth ? 1 : 0.3,
                padding: pad,
                overflow: 'hidden',
                display: 'flex',
                flexDirection: 'column',
                cursor: inMonth ? 'pointer' : 'default',
              }}
            >
              {/* Date number */}
              <div style={{ marginBottom: 2, flexShrink: 0 }}>
                <span
                  style={{
                    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                    width: dateCircle, height: dateCircle, borderRadius: '50%',
                    fontSize: dateFontSize, fontWeight: 600, lineHeight: 1,
                    background: today ? 'var(--accent)' : 'transparent',
                    color: today ? 'var(--bg)' : i % 7 >= 5 ? 'var(--text-muted)' : 'var(--text)',
                  }}
                >
                  {format(day, 'd')}
                </span>
              </div>

              {/* Items */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 1, overflow: 'hidden', flex: 1 }}>
                {/* Todos */}
                {todosVisible.map(todo => (
                  <div
                    key={todo.id}
                    onClick={e => e.stopPropagation()}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 2,
                      padding: `1px ${pad}px`, borderRadius: 3,
                      background: 'var(--bg-hover)',
                      fontSize: todoFont,
                      color: todo.completed ? 'var(--text-dim)' : 'var(--text)',
                      textDecoration: todo.completed ? 'line-through' : 'none',
                      overflow: 'hidden', flexShrink: 0,
                    }}
                  >
                    <div
                      style={{
                        width: dot, height: dot, borderRadius: '50%', flexShrink: 0,
                        background: PRIORITY_COLOR[todo.priority] ?? PRIORITY_COLOR.medium,
                        opacity: todo.completed ? 0.4 : 1,
                      }}
                    />
                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>
                      {todo.title}
                    </span>
                  </div>
                ))}

                {/* App Timeline Entries */}
                {timelineVisible.map(entry => {
                  const color = CAT_COLOR[entry.category ?? ''] ?? CAT_COLOR.other
                  return (
                    <div
                      key={entry.id}
                      onClick={e => e.stopPropagation()}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 2,
                        padding: `1px ${pad}px`, borderRadius: 3,
                        background: `${color}22`,
                        fontSize: todoFont,
                        color: color,
                        overflow: 'hidden', flexShrink: 0,
                      }}
                    >
                      <div style={{ width: dot, height: dot, borderRadius: '50%', flexShrink: 0, background: color }} />
                      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>
                        {entry.startTime} {entry.title}
                      </span>
                    </div>
                  )
                })}

                {/* Google Calendar Events */}
                {calVisible.map(event => (
                  <div
                    key={event.id}
                    onClick={e => e.stopPropagation()}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 2,
                      padding: `1px ${pad}px`, borderRadius: 3,
                      background: `${event.calendarColor}22`,
                      fontSize: todoFont,
                      color: event.calendarColor,
                      overflow: 'hidden', flexShrink: 0,
                    }}
                  >
                    <div
                      style={{
                        width: dot, height: dot, borderRadius: '50%', flexShrink: 0,
                        background: event.calendarColor,
                      }}
                    />
                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>
                      {format(new Date(event.start.dateTime), 'H:mm')} {event.summary ?? '(제목 없음)'}
                    </span>
                  </div>
                ))}

                {/* 더보기 */}
                {overflow > 0 && (
                  <div style={{ fontSize: Math.max(8, todoFont - 1), color: 'var(--text-dim)', paddingLeft: pad }}>
                    +{overflow}
                  </div>
                )}

                {/* 인라인 투두 추가 */}
                {isAdding && (
                  <input
                    ref={inputRef}
                    value={newTitle}
                    onChange={e => setNewTitle(e.target.value)}
                    onClick={e => e.stopPropagation()}
                    style={{
                      fontSize: todoFont, width: '100%',
                      background: 'var(--bg-input)', border: '1px solid var(--accent)',
                      borderRadius: 3, color: 'var(--text)', padding: '1px 4px', outline: 'none',
                    }}
                    onKeyDown={e => {
                      if (e.key === 'Enter') handleAddSubmit(day)
                      if (e.key === 'Escape') { setAddingDay(null); setNewTitle('') }
                    }}
                    onBlur={() => { setAddingDay(null); setNewTitle('') }}
                  />
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
