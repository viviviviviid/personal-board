'use client'

import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import {
  format, addMonths, startOfMonth, endOfMonth,
  startOfWeek, endOfWeek, addDays, isSameDay, isToday, isSameMonth,
} from 'date-fns'

// ── Types ──────────────────────────────────────────────────────────────────
interface Todo {
  id: string
  title: string
  completed: boolean
  priority: string
  date: string | null
}

// ── Constants ──────────────────────────────────────────────────────────────
const DAYS_KO = ['월', '화', '수', '목', '금', '토', '일']
const PRIORITY_COLOR: Record<string, string> = {
  high: '#EF4444',
  medium: '#F59E0B',
  low: '#A1A1AA',
}
// 월 제목 + 요일 헤더 높이 (px) — 고정
const HEADER_H = 58

// ── Props ──────────────────────────────────────────────────────────────────
interface Props {
  currentMonth: Date
  monthCount: 1 | 2 | 3
}

// ── Main component ─────────────────────────────────────────────────────────
export default function MonthlyCalendar({ currentMonth, monthCount }: Props) {
  const [todos, setTodos] = useState<Todo[]>([])
  const [loading, setLoading] = useState(true)
  const [cellSize, setCellSize] = useState(80)
  const containerRef = useRef<HTMLDivElement>(null)

  const months = useMemo(
    () => Array.from({ length: monthCount }, (_, i) => addMonths(currentMonth, i)),
    [currentMonth, monthCount],
  )

  // 표시되는 달 중 최대 주 수 (4~6주)
  const maxNumWeeks = useMemo(() => {
    return Math.max(...months.map(m => {
      const s = startOfWeek(startOfMonth(m), { weekStartsOn: 1 })
      const e = endOfWeek(endOfMonth(m), { weekStartsOn: 1 })
      let n = 0, cur = s
      while (cur <= e) { n++; cur = addDays(cur, 1) }
      return n / 7
    }))
  }, [months])

  // 컨테이너 크기 변화 감지 → 셀 크기 재계산
  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const obs = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect
      // 월별 가용 너비 (gap 제외)
      const perMonthW = (width - (monthCount - 1) * 12) / monthCount
      // 가로 기준: 7칸으로 나눈 크기
      const fromW = Math.floor(perMonthW / 7)
      // 세로 기준: 헤더 제외 후 주 수로 나눈 크기
      const fromH = Math.floor((height - HEADER_H) / maxNumWeeks)
      // 둘 중 작은 값으로 비율 유지
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
      const res = await fetch(`/api/todos?startDate=${startDate}&endDate=${endDate}`)
      if (res.ok) setTodos(await res.json())
    } catch {
      // ignore
    } finally {
      setLoading(false)
    }
  }, [currentMonth, monthCount])

  useEffect(() => { fetchTodos() }, [fetchTodos])

  const todosForDay = (day: Date) =>
    todos.filter(t => t.date && isSameDay(new Date(t.date), day))

  return (
    <div
      ref={containerRef}
      style={{
        flex: 1,
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
          todosForDay={todosForDay}
          loading={loading}
          onRefresh={fetchTodos}
        />
      ))}
    </div>
  )
}

// ── Month grid ─────────────────────────────────────────────────────────────
function MonthGrid({
  month,
  cellSize,
  todosForDay,
  loading,
  onRefresh,
}: {
  month: Date
  cellSize: number
  todosForDay: (day: Date) => Todo[]
  loading: boolean
  onRefresh: () => void
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

  // cellSize에 비례한 UI 수치
  const pad = Math.max(2, Math.round(cellSize * 0.05))
  const dateFontSize = Math.max(9, Math.min(13, Math.round(cellSize * 0.19)))
  const dateCircle = Math.max(16, Math.min(22, Math.round(cellSize * 0.31)))
  const todoFont = Math.max(8, Math.min(11, Math.round(cellSize * 0.14)))
  const dot = Math.max(4, Math.min(6, Math.round(cellSize * 0.08)))
  // 셀 높이에서 날짜 원 + 패딩을 뺀 공간에 들어갈 투두 수
  const maxVisible = Math.max(1, Math.floor((cellSize - dateCircle - pad * 3) / (todoFont + 5)))

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
      <div
        style={{
          background: 'var(--bg-surface)',
          borderBottom: '1px solid var(--border)',
          padding: '6px 10px',
        }}
      >
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
              textAlign: 'center',
              padding: '4px 0',
              fontSize: 10,
              fontWeight: 600,
              letterSpacing: '0.04em',
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
          const visible = dayTodos.slice(0, maxVisible)
          const overflow = dayTodos.length - maxVisible
          const dayKey = format(day, 'yyyy-MM-dd')
          const isAdding = addingDay === dayKey

          return (
            <div
              key={i}
              onClick={() => {
                if (inMonth && !isAdding) {
                  setAddingDay(dayKey)
                  setNewTitle('')
                }
              }}
              style={{
                background: today
                  ? 'rgba(139, 92, 246, 0.06)'
                  : inMonth ? 'var(--bg-card)' : 'var(--bg-surface)',
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
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    width: dateCircle,
                    height: dateCircle,
                    borderRadius: '50%',
                    fontSize: dateFontSize,
                    fontWeight: 600,
                    lineHeight: 1,
                    background: today ? 'var(--accent)' : 'transparent',
                    color: today
                      ? 'var(--bg)'
                      : i % 7 >= 5 ? 'var(--text-muted)' : 'var(--text)',
                  }}
                >
                  {format(day, 'd')}
                </span>
              </div>

              {/* Todos */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 1, overflow: 'hidden', flex: 1 }}>
                {visible.map(todo => (
                  <div
                    key={todo.id}
                    onClick={e => e.stopPropagation()}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 2,
                      padding: `1px ${pad}px`,
                      borderRadius: 3,
                      background: 'var(--bg-hover)',
                      fontSize: todoFont,
                      color: todo.completed ? 'var(--text-dim)' : 'var(--text)',
                      textDecoration: todo.completed ? 'line-through' : 'none',
                      overflow: 'hidden',
                      flexShrink: 0,
                    }}
                  >
                    <div
                      style={{
                        width: dot,
                        height: dot,
                        borderRadius: '50%',
                        flexShrink: 0,
                        background: PRIORITY_COLOR[todo.priority] ?? PRIORITY_COLOR.medium,
                        opacity: todo.completed ? 0.4 : 1,
                      }}
                    />
                    <span
                      style={{
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                        flex: 1,
                      }}
                    >
                      {todo.title}
                    </span>
                  </div>
                ))}
                {overflow > 0 && (
                  <div style={{ fontSize: Math.max(8, todoFont - 1), color: 'var(--text-dim)', paddingLeft: pad }}>
                    +{overflow} 더보기
                  </div>
                )}
                {isAdding && (
                  <input
                    ref={inputRef}
                    value={newTitle}
                    onChange={e => setNewTitle(e.target.value)}
                    onClick={e => e.stopPropagation()}
                    style={{
                      fontSize: todoFont,
                      width: '100%',
                      background: 'var(--bg-input)',
                      border: '1px solid var(--accent)',
                      borderRadius: 3,
                      color: 'var(--text)',
                      padding: '1px 4px',
                      outline: 'none',
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
