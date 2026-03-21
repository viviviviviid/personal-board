'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useSwipe } from '@/hooks/useSwipe'
import { format, addWeeks, subWeeks, startOfWeek, addDays, isSameDay, isToday, addMonths, subMonths, startOfMonth } from 'date-fns'
import { ChevronLeft, ChevronRight, Plus, Check, X, CalendarDays, RefreshCw, Unlink, AlertCircle } from 'lucide-react'
import { signIn } from 'next-auth/react'
import AIFeedback from './AIFeedback'
import MonthlyCalendar from './MonthlyCalendar'
import PomodoroTimer from './PomodoroTimer'
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
  urgent: boolean
  date: string | null
}

interface DailyHighlight {
  id: string
  date: string
  content: string
  completed: boolean
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

// ── Overlap layout ─────────────────────────────────────────────────────────
function computeOverlapLayout(
  items: Array<{ id: string; start: string; end: string }>
): Map<string, { col: number; total: number }> {
  const result = new Map<string, { col: number; total: number }>()
  if (items.length === 0) return result

  const sorted = [...items].sort((a, b) => a.start.localeCompare(b.start))

  let i = 0
  while (i < sorted.length) {
    let groupEnd = sorted[i].end
    let j = i + 1
    while (j < sorted.length && sorted[j].start < groupEnd) {
      if (sorted[j].end > groupEnd) groupEnd = sorted[j].end
      j++
    }
    const group = sorted.slice(i, j)

    const colEnds: string[] = []
    const colAssignments: number[] = []
    for (const item of group) {
      let placed = -1
      for (let col = 0; col < colEnds.length; col++) {
        if (colEnds[col] <= item.start) {
          colEnds[col] = item.end
          placed = col
          break
        }
      }
      if (placed === -1) {
        placed = colEnds.length
        colEnds.push(item.end)
      }
      colAssignments.push(placed)
    }

    const total = colEnds.length
    group.forEach((item, idx) => result.set(item.id, { col: colAssignments[idx], total }))
    i = j
  }

  return result
}

// ── Entry block ────────────────────────────────────────────────────────────
interface EntryBlockProps {
  entry: TimelineEntry
  onDelete: () => void
  onDragStart: (e: React.MouseEvent, type: 'move' | 'resize') => void
  layoutCol?: number
  layoutTotal?: number
}

function EntryBlock({ entry, onDelete, onDragStart, layoutCol = 0, layoutTotal = 1 }: EntryBlockProps) {
  const top = timeToY(entry.startTime)
  const effEnd = entry.endTime || addOneHour(entry.startTime)
  const height = Math.max(20, timeToY(effEnd) - top)
  const s = CAT_STYLE[entry.category || ''] ?? DEF_STYLE

  const GAP = 2
  const pct = 100 / layoutTotal
  const colLeft = `calc(${layoutCol * pct}% + ${GAP}px)`
  const colWidth = `calc(${pct}% - ${GAP * 2}px)`

  return (
    <div
      style={{
        position: 'absolute', top, left: colLeft, width: colWidth, height, zIndex: 10,
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
function GoogleEventBlock({ event, layoutCol = 0, layoutTotal = 1 }: { event: GoogleCalendarEvent; layoutCol?: number; layoutTotal?: number }) {
  const startTime = format(new Date(event.start.dateTime), 'HH:mm')
  const endTime = format(new Date(event.end.dateTime), 'HH:mm')
  const top = timeToY(startTime)
  const height = Math.max(20, timeToY(endTime) - top)
  const color = event.calendarColor ?? '#4285F4'

  const GAP = 2
  const pct = 100 / layoutTotal
  const colLeft = `calc(${layoutCol * pct}% + ${GAP}px)`
  const colWidth = `calc(${pct}% - ${GAP * 2}px)`

  return (
    <div
      style={{
        position: 'absolute', top, left: colLeft, width: colWidth, height, zIndex: 9,
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
  const [view, setView] = useState<'weekly' | 'monthly' | 'matrix'>('weekly')
  const [currentWeekStart, setCurrentWeekStart] = useState(() =>
    startOfWeek(new Date(), { weekStartsOn: 1 })
  )
  const [currentMonth, setCurrentMonth] = useState(() => startOfMonth(new Date()))
  const [monthCount, setMonthCount] = useState<1 | 2 | 3>(1)
  const [todos, setTodos] = useState<Todo[]>([])
  const [timeline, setTimeline] = useState<TimelineEntry[]>([])
  const [googleEvents, setGoogleEvents] = useState<GoogleCalendarEvent[]>([])
  const [calendarList, setCalendarList] = useState<GoogleCalendar[]>([])
  const [weeklyEnabledCals, setWeeklyEnabledCals] = useState<Set<string>>(new Set())
  const [monthlyEnabledCals, setMonthlyEnabledCals] = useState<Set<string>>(new Set())
  const [highlights, setHighlights] = useState<DailyHighlight[]>([])
  const [calPanelOpen, setCalPanelOpen] = useState(false)
  const [isMobile, setIsMobile] = useState(false)
  const [mobileDay, setMobileDay] = useState(() => {
    const today = new Date().getDay()
    // 월요일=0 ... 일요일=6
    return today === 0 ? 6 : today - 1
  })
  const [calStatus, setCalStatus] = useState<'loading' | 'ok' | 'no_token' | 'error'>('loading')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [now, setNow] = useState(new Date())

  const [slideDir, setSlideDir] = useState<'next' | 'prev' | null>(null)
  const [monthSlideDir, setMonthSlideDir] = useState<'next' | 'prev' | null>(null)
  const gridScrollRef = useRef<HTMLDivElement>(null)

  const [addingTodoDay, setAddingTodoDay] = useState<string | null>(null)
  const [highlightOpenDay, setHighlightOpenDay] = useState<string | null>(null)
  const [newTodoTitle, setNewTodoTitle] = useState('')
  const [addingEntry, setAddingEntry] = useState<{ dateKey: string; hour: number } | null>(null)
  const [newEntry, setNewEntry] = useState({ title: '', endTime: '', category: '' })
  const [onboardingDone, setOnboardingDone] = useState(true) // default true — localStorage로 덮어씀

  useEffect(() => {
    if (!localStorage.getItem('pb-onboarding-done')) setOnboardingDone(false)
  }, [])

  const dismissOnboarding = () => {
    localStorage.setItem('pb-onboarding-done', '1')
    setOnboardingDone(true)
  }

  // 캘린더 연결 유도 배너 (최초 1회)
  const [calPromptDismissed, setCalPromptDismissed] = useState(true)

  useEffect(() => {
    if (!localStorage.getItem('pb-cal-prompted')) setCalPromptDismissed(false)
  }, [])

  const dismissCalPrompt = () => {
    localStorage.setItem('pb-cal-prompted', '1')
    setCalPromptDismissed(true)
  }

  const connectCalendar = () => {
    dismissCalPrompt()
    signIn('google', { callbackUrl: '/' }, {
      scope: 'openid email profile https://www.googleapis.com/auth/calendar.readonly',
      access_type: 'offline',
      prompt: 'consent',
    } as Record<string, string>)
  }

  // Google Calendar 목록 fetch
  const fetchCalendarList = useCallback(async () => {
    setCalStatus('loading')
    try {
      const res = await fetch('/api/google-calendar/list')
      if (!res.ok) { setCalStatus('error'); return }
      const data = await res.json()
      const status = data.status ?? 'ok'
      const cals: GoogleCalendar[] = data.calendars ?? []

      if (status === 'no_token') {
        setCalStatus('no_token')
        return
      }
      if (status !== 'ok' && cals.length === 0) {
        setCalStatus('error')
        return
      }

      setCalendarList(cals)
      setCalStatus('ok')
      const allIds = cals.map(c => c.id)
      // localStorage에서 복원, 없으면 전체 활성화
      const savedWeekly = localStorage.getItem('enabled-calendars-weekly')
      setWeeklyEnabledCals(savedWeekly ? new Set(JSON.parse(savedWeekly)) : new Set(allIds))
      const savedMonthly = localStorage.getItem('enabled-calendars-monthly')
      setMonthlyEnabledCals(savedMonthly ? new Set(JSON.parse(savedMonthly)) : new Set(allIds))
    } catch {
      setCalStatus('error')
    }
  }, [])

  useEffect(() => { fetchCalendarList() }, [fetchCalendarList])

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

  const toggleCalendarWeekly = (calId: string) => {
    setWeeklyEnabledCals(prev => {
      const next = new Set(prev)
      if (next.has(calId)) next.delete(calId); else next.add(calId)
      localStorage.setItem('enabled-calendars-weekly', JSON.stringify([...next]))
      return next
    })
  }

  const toggleCalendarMonthly = (calId: string) => {
    setMonthlyEnabledCals(prev => {
      const next = new Set(prev)
      if (next.has(calId)) next.delete(calId); else next.add(calId)
      localStorage.setItem('enabled-calendars-monthly', JSON.stringify([...next]))
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

  // 모바일 감지
  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768)
    check()
    window.addEventListener('resize', check)
    return () => window.removeEventListener('resize', check)
  }, [])

  const navigateWeek = useCallback((dir: 'next' | 'prev') => {
    setSlideDir(dir)
    setCurrentWeekStart(d => dir === 'next' ? addWeeks(d, 1) : subWeeks(d, 1))
  }, [])

  const navigateDay = useCallback((dir: 'next' | 'prev') => {
    if (!isMobile) {
      navigateWeek(dir)
      return
    }
    if (dir === 'next') {
      if (mobileDay < 6) {
        setMobileDay(d => d + 1)
      } else {
        setSlideDir('next')
        setCurrentWeekStart(d => addWeeks(d, 1))
        setMobileDay(0)
      }
    } else {
      if (mobileDay > 0) {
        setMobileDay(d => d - 1)
      } else {
        setSlideDir('prev')
        setCurrentWeekStart(d => subWeeks(d, 1))
        setMobileDay(6)
      }
    }
  }, [isMobile, mobileDay, navigateWeek])

  // 타임라인 스크롤 초기 위치
  useEffect(() => {
    const el = gridScrollRef.current
    if (!el) return

    const DEFAULT_HOUR = 9
    const defaultY = (DEFAULT_HOUR - FIRST_HOUR) * ROW_H  // 9시 = 208px

    // 모바일: 선택된 날짜, 데스크탑: 주 첫날 기준
    const targetDay = isMobile ? weekDays[mobileDay] : weekDays[0]
    const dayEntries = timeline
      .filter(e => isSameDay(new Date(e.date), targetDay))
      .sort((a, b) => a.startTime.localeCompare(b.startTime))

    let scrollY: number
    if (dayEntries.length > 0) {
      const [h, m] = dayEntries[0].startTime.split(':').map(Number)
      const entryY = (h - FIRST_HOUR) * ROW_H + (m / 60) * ROW_H
      // 이벤트 위에 여백 확보, 최소 0, 최대는 브라우저가 자연히 클램프
      scrollY = Math.max(0, entryY - 80)
    } else {
      scrollY = defaultY
    }

    const timer = setTimeout(() => {
      el.scrollTo({ top: scrollY, behavior: 'instant' as ScrollBehavior })
    }, 30)
    return () => clearTimeout(timer)
  }, [currentWeekStart, mobileDay, loading])

  const swipeHandlers = useSwipe(
    () => {
      if (view === 'monthly') { setMonthSlideDir('next'); setCurrentMonth(d => addMonths(d, 1)) }
      else navigateDay('next')
    },
    () => {
      if (view === 'monthly') { setMonthSlideDir('prev'); setCurrentMonth(d => subMonths(d, 1)) }
      else navigateDay('prev')
    },
  )

  // 좌우 화살표 키로 주 이동
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (view !== 'weekly' && view !== 'matrix') return
      const tag = (e.target as HTMLElement).tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return
      if (e.key === 'ArrowLeft') navigateWeek('prev')
      if (e.key === 'ArrowRight') navigateWeek('next')
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [view, navigateWeek])

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

      // 하이라이트 fetch (weekly view용)
      fetch(`/api/daily-highlight?week=${wp}`)
        .then(r => r.ok ? r.json() : [])
        .then(setHighlights)
        .catch(() => {})

      const gcPromise = weeklyEnabledCals.size > 0
        ? (() => {
            const ids = [...weeklyEnabledCals]
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
  }, [currentWeekStart, weeklyEnabledCals, calendarList])

  useEffect(() => { fetchData() }, [fetchData])

  // ── Handlers ─────────────────────────────────────────────────────────────
  const moveTodo = async (id: string, urgent: boolean, important: boolean) => {
    const todo = todos.find(t => t.id === id)
    if (!todo) return
    const newPriority = important ? 'high' : todo.priority === 'high' ? 'medium' : todo.priority
    setTodos(prev => prev.map(t => t.id === id ? { ...t, urgent, priority: newPriority } : t))
    await fetch(`/api/todos/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ urgent, priority: newPriority }),
    }).catch(() => fetchData())
  }

  const toggleUrgent = async (id: string, urgent: boolean) => {
    setTodos(prev => prev.map(t => t.id === id ? { ...t, urgent: !urgent } : t))
    await fetch(`/api/todos/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ urgent: !urgent }),
    }).catch(() => fetchData())
  }

  const setHighlight = async (date: string, content: string) => {
    if (!content.trim()) return
    try {
      const res = await fetch('/api/daily-highlight', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ date, content }),
      })
      if (res.ok) {
        const h = await res.json()
        setHighlights(prev => {
          const filtered = prev.filter(x => x.date !== date)
          return [...filtered, h]
        })
      }
    } catch { /* ignore */ }
  }

  const toggleHighlight = async (h: DailyHighlight) => {
    try {
      const res = await fetch('/api/daily-highlight', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ date: h.date, completed: !h.completed }),
      })
      if (res.ok) {
        const updated = await res.json()
        setHighlights(prev => prev.map(x => x.date === h.date ? updated : x))
      }
    } catch { /* ignore */ }
  }

  const deleteHighlight = async (date: string) => {
    try {
      await fetch(`/api/daily-highlight?date=${date}`, { method: 'DELETE' })
      setHighlights(prev => prev.filter(x => x.date !== date))
    } catch { /* ignore */ }
  }

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
    const todo: Todo = { id: tempId, title: newTodoTitle.trim(), completed: false, priority: 'medium', urgent: false, date: day.toISOString() }
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
  const visibleDays = isMobile ? [weekDays[mobileDay]] : weekDays

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }} {...swipeHandlers}>

      {/* Header — 2-row layout */}
      <div className="flex flex-col gap-2 mb-3 flex-shrink-0">

        {/* Row 1: Title + view toggle + icon buttons */}
        <div className="flex items-center justify-between gap-2">
          <div className="min-w-0">
            <h1 className="text-base font-bold truncate" style={{ color: 'var(--text-bright)' }}>
              {view === 'weekly' ? '주간 보드' : view === 'monthly' ? '월간 캘린더' : '매트릭스'}
            </h1>
            <p className="text-xs" style={{ color: 'var(--text-dim)' }}>
              {view === 'weekly' ? weekLabel : view === 'monthly' ? monthLabel : '긴급/중요 우선순위'}
            </p>
          </div>
          <div className="flex items-center gap-1.5 flex-shrink-0">
            {/* View toggle */}
            <div className="flex rounded-lg overflow-hidden" style={{ border: '1px solid var(--border)' }}>
              {(['weekly', 'monthly', 'matrix'] as const).map((v, i) => (
                <button
                  key={v}
                  onClick={() => setView(v)}
                  className="px-2 py-1 text-xs transition-all"
                  style={{
                    background: view === v ? 'var(--accent-dim)' : 'var(--bg-card)',
                    color: view === v ? 'var(--accent-light)' : 'var(--text-muted)',
                    borderRight: i < 2 ? '1px solid var(--border)' : 'none',
                  }}
                >
                  {isMobile
                    ? (v === 'weekly' ? '주' : v === 'monthly' ? '월' : 'M')
                    : (v === 'weekly' ? '주간' : v === 'monthly' ? '월간' : '매트릭스')}
                </button>
              ))}
            </div>
            {/* 포모도로 타이머 */}
            <PomodoroTimer />
            {/* Google Calendar 버튼 */}
            <div style={{ position: 'relative' }} data-cal-panel>
              {(calStatus === 'no_token' || calStatus === 'error') && (
                <button
                  onClick={() => signIn('google', { callbackUrl: '/' }, { scope: 'openid email profile https://www.googleapis.com/auth/calendar.readonly', access_type: 'offline', prompt: 'consent' })}
                  className="p-1.5 rounded-lg transition-all flex items-center gap-1.5 text-[11px]"
                  style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', color: 'var(--text-dim)' }}
                  title="Google Calendar 연결"
                >
                  <Unlink size={13} />
                  {!isMobile && <span>캘린더 연결</span>}
                </button>
              )}
              {calStatus === 'loading' && (
                <div className="p-1.5 rounded-lg" style={{ border: '1px solid var(--border-dim)', color: 'var(--text-dim)' }}>
                  <CalendarDays size={14} className="opacity-40" />
                </div>
              )}
              {calStatus === 'ok' && (
                <>
                  <button
                    onClick={() => setCalPanelOpen(v => !v)}
                    className="p-1.5 rounded-lg transition-all"
                    style={{
                      background: calPanelOpen ? 'var(--accent-dim)' : 'var(--bg-card)',
                      border: `1px solid ${calPanelOpen ? 'var(--accent)' : 'var(--border)'}`,
                      color: calPanelOpen ? 'var(--accent-light)' : 'var(--text-muted)',
                    }}
                    title="Google Calendar"
                  >
                    <CalendarDays size={14} />
                  </button>
                  {calPanelOpen && (
                    <div
                      style={{
                        position: 'fixed',
                        top: isMobile ? 'auto' : undefined,
                        bottom: isMobile ? 80 : undefined,
                        right: isMobile ? 8 : 0,
                        marginTop: isMobile ? 0 : 6,
                        background: 'var(--bg-surface)',
                        border: '1px solid var(--border)',
                        borderRadius: 12, padding: '8px 4px',
                        width: isMobile ? 'calc(100vw - 16px)' : 260,
                        zIndex: 200,
                        boxShadow: '0 4px 20px rgba(0,0,0,0.3)',
                      }}
                    >
                      <div className="px-3 pb-1.5 flex items-center justify-between" style={{ borderBottom: '1px solid var(--border-dim)', marginBottom: 4 }}>
                        <span className="text-[10px] font-semibold tracking-wide" style={{ color: 'var(--text-dim)' }}>GOOGLE CALENDAR</span>
                        <button
                          onClick={() => { fetchCalendarList(); setCalPanelOpen(false) }}
                          className="p-0.5 rounded"
                          style={{ color: 'var(--text-dim)' }}
                          title="새로고침"
                        >
                          <RefreshCw size={11} />
                        </button>
                      </div>
                      <div className="flex items-center px-3 pb-1 mb-1" style={{ borderBottom: '1px solid var(--border-dim)' }}>
                        <span className="flex-1 text-[10px]" style={{ color: 'var(--text-dim)' }} />
                        <span className="w-7 text-center text-[10px] font-semibold" style={{ color: 'var(--text-dim)' }}>주</span>
                        <span className="w-7 text-center text-[10px] font-semibold" style={{ color: 'var(--text-dim)' }}>월</span>
                      </div>
                      {calendarList.map(cal => (
                        <div
                          key={cal.id}
                          className="flex items-center gap-2 px-3 py-1.5 rounded-lg"
                          style={{ background: 'transparent' }}
                        >
                          <div style={{ width: 9, height: 9, borderRadius: '50%', flexShrink: 0, background: cal.backgroundColor }} />
                          <span className="text-[12px] truncate flex-1" style={{ color: 'var(--text)' }}>
                            {cal.summary}
                            {cal.primary && <span className="ml-1 text-[9px]" style={{ color: 'var(--text-dim)' }}>기본</span>}
                          </span>
                          <button onClick={() => toggleCalendarWeekly(cal.id)} className="w-7 flex items-center justify-center" title="주간에 표시">
                            <div style={{ width: 14, height: 14, borderRadius: 3, flexShrink: 0, background: weeklyEnabledCals.has(cal.id) ? cal.backgroundColor : 'transparent', border: `2px solid ${weeklyEnabledCals.has(cal.id) ? cal.backgroundColor : 'var(--border)'}`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                              {weeklyEnabledCals.has(cal.id) && <svg width="8" height="8" viewBox="0 0 8 8" fill="none"><path d="M1.5 4L3 5.5L6.5 2" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>}
                            </div>
                          </button>
                          <button onClick={() => toggleCalendarMonthly(cal.id)} className="w-7 flex items-center justify-center" title="월간에 표시">
                            <div style={{ width: 14, height: 14, borderRadius: 3, flexShrink: 0, background: monthlyEnabledCals.has(cal.id) ? cal.backgroundColor : 'transparent', border: `2px solid ${monthlyEnabledCals.has(cal.id) ? cal.backgroundColor : 'var(--border)'}`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                              {monthlyEnabledCals.has(cal.id) && <svg width="8" height="8" viewBox="0 0 8 8" fill="none"><path d="M1.5 4L3 5.5L6.5 2" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>}
                            </div>
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </div>

        {/* Row 2: Navigation */}
        {(view === 'weekly' || view === 'matrix') && (
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => navigateWeek('prev')}
              className="rounded-lg transition-all flex items-center justify-center"
              style={{
                background: 'var(--bg-card)', border: '1px solid var(--border)', color: 'var(--text-muted)',
                padding: isMobile ? '8px 12px' : '6px',
              }}
            >
              <ChevronLeft size={isMobile ? 18 : 15} />
            </button>
            <button
              onClick={() => setCurrentWeekStart(startOfWeek(new Date(), { weekStartsOn: 1 }))}
              className="rounded-lg transition-all"
              style={{
                background: 'var(--bg-card)', border: '1px solid var(--border)', color: 'var(--text-muted)',
                padding: isMobile ? '7px 14px' : '4px 10px',
                fontSize: isMobile ? 13 : 12,
              }}
            >
              이번 주
            </button>
            <button
              onClick={() => navigateWeek('next')}
              className="rounded-lg transition-all flex items-center justify-center"
              style={{
                background: 'var(--bg-card)', border: '1px solid var(--border)', color: 'var(--text-muted)',
                padding: isMobile ? '8px 12px' : '6px',
              }}
            >
              <ChevronRight size={isMobile ? 18 : 15} />
            </button>
            {!isMobile && view === 'weekly' && <AIFeedback weekStart={currentWeekStart} />}
          </div>
        )}
        {view === 'monthly' && (
          <div className="flex items-center gap-1.5">
            {!isMobile && (
              <div className="flex rounded-lg overflow-hidden" style={{ border: '1px solid var(--border)' }}>
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
            )}
            <button
              onClick={() => { setMonthSlideDir('prev'); setCurrentMonth(d => subMonths(d, 1)) }}
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
              onClick={() => { setMonthSlideDir('next'); setCurrentMonth(d => addMonths(d, 1)) }}
              className="p-1.5 rounded-lg transition-all"
              style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', color: 'var(--text-muted)' }}
            >
              <ChevronRight size={15} />
            </button>
          </div>
        )}
      </div>

      {/* ── 매트릭스 뷰 ────────────────────────────────────────────────────── */}
      {view === 'matrix' && (
        <MatrixView
          todos={todos}
          weekLabel={weekLabel}
          onToggle={toggleTodo}
          onToggleUrgent={toggleUrgent}
          onDelete={deleteTodo}
          onMove={moveTodo}
          isMobile={isMobile}
        />
      )}

      {view === 'monthly' && (
        <div
          key={format(currentMonth, 'yyyy-MM')}
          className={monthSlideDir === 'next' ? 'week-slide-next' : monthSlideDir === 'prev' ? 'week-slide-prev' : ''}
          onAnimationEnd={() => setMonthSlideDir(null)}
          style={{ flex: 1, minHeight: 0 }}
        >
          <MonthlyCalendar
            currentMonth={currentMonth}
            monthCount={monthCount}
            enabledCalendars={monthlyEnabledCals}
            calendarList={calendarList}
          />
        </div>
      )}

      {/* 모바일 날짜 탭 */}
      {view === 'weekly' && isMobile && (
        <div className="flex gap-1 mb-3 overflow-x-auto flex-shrink-0">
          {weekDays.map((day, i) => {
            const today = isToday(day)
            const isSelected = mobileDay === i
            return (
              <button
                key={i}
                onClick={() => setMobileDay(i)}
                className="flex flex-col items-center gap-0.5 px-3 py-2 rounded-xl flex-shrink-0 transition-all"
                style={{
                  background: isSelected ? 'var(--accent-dim)' : today ? 'rgba(139,92,246,0.06)' : 'var(--bg-card)',
                  border: `1px solid ${isSelected ? 'var(--accent)' : today ? 'rgba(139,92,246,0.3)' : 'var(--border)'}`,
                  minWidth: 48,
                }}
              >
                <span
                  className="text-[10px] font-semibold"
                  style={{ color: isSelected ? 'var(--accent-light)' : today ? 'var(--accent)' : 'var(--text-dim)' }}
                >
                  {DAYS_KO[i]}
                </span>
                <span
                  className="text-lg font-bold leading-none"
                  style={{ color: isSelected ? 'var(--accent-light)' : today ? 'var(--accent-light)' : 'var(--text-bright)' }}
                >
                  {format(day, 'd')}
                </span>
              </button>
            )
          })}
        </div>
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
      {/* 모바일 TODO 입력 — 키보드 올라와도 레이아웃 밀림 없음 */}
      {isMobile && addingTodoDay && (
        <div
          style={{
            position: 'fixed',
            left: 0,
            right: 0,
            bottom: 0,
            zIndex: 1000,
            background: 'var(--bg-surface)',
            borderTop: '1px solid var(--border)',
            padding: '10px 16px',
            paddingBottom: 'max(10px, env(safe-area-inset-bottom))',
            boxShadow: '0 -4px 20px rgba(0,0,0,0.3)',
          }}
        >
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={newTodoTitle}
              onChange={e => setNewTodoTitle(e.target.value)}
              onKeyDown={e => {
                if (e.nativeEvent.isComposing) return
                if (e.key === 'Enter') {
                  const day = weekDays.find(d => format(d, 'yyyy-MM-dd') === addingTodoDay)
                  if (day) submitTodo(day)
                }
                if (e.key === 'Escape') { setAddingTodoDay(null); setNewTodoTitle('') }
              }}
              placeholder="할일 추가..."
              className="flex-1 text-[14px] focus:outline-none rounded-xl px-3 py-2.5"
              style={{
                background: 'var(--bg-input)',
                border: '1px solid var(--accent-dim)',
                color: 'var(--text)',
              }}
              autoFocus
            />
            <button
              onClick={() => {
                const day = weekDays.find(d => format(d, 'yyyy-MM-dd') === addingTodoDay)
                if (day) submitTodo(day)
              }}
              className="p-2.5 rounded-xl flex-shrink-0"
              style={{ background: 'var(--accent-dim)', color: 'var(--accent-light)', border: '1px solid var(--accent)' }}
            >
              <Check size={16} />
            </button>
            <button
              onClick={() => { setAddingTodoDay(null); setNewTodoTitle('') }}
              className="p-2.5 rounded-xl flex-shrink-0"
              style={{ background: 'var(--bg-card)', color: 'var(--text-dim)', border: '1px solid var(--border)' }}
            >
              <X size={16} />
            </button>
          </div>
        </div>
      )}

      {/* ── Google Calendar 연결 유도 배너 (최초 1회) ───────────────────── */}
      {view === 'weekly' && !loading && !calPromptDismissed && calStatus === 'no_token' && (
        <div
          className="flex-shrink-0 rounded-xl p-3 mb-3 flex items-center gap-3"
          style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}
        >
          <CalendarDays size={18} style={{ color: 'var(--accent-light)', flexShrink: 0 }} />
          <div className="flex-1 min-w-0">
            <p className="text-[13px] font-medium" style={{ color: 'var(--text)' }}>Google 캘린더 일정을 함께 볼까요?</p>
            <p className="text-[11px]" style={{ color: 'var(--text-dim)' }}>주간 보드에 내 캘린더 일정을 오버레이할 수 있어요.</p>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <button
              onClick={connectCalendar}
              className="px-3 py-1.5 rounded-lg text-xs font-medium transition-all"
              style={{ background: 'var(--accent-dim)', border: '1px solid var(--accent)', color: 'var(--accent-light)' }}
            >
              연결하기
            </button>
            <button
              onClick={dismissCalPrompt}
              className="p-1.5 rounded-lg transition-all"
              style={{ color: 'var(--text-dim)' }}
              title="닫기"
            >
              <X size={14} />
            </button>
          </div>
        </div>
      )}

      {/* ── 온보딩 배너 ─────────────────────────────────────────────────── */}
      {view === 'weekly' && !loading && !onboardingDone && (
        <div
          className="flex-shrink-0 rounded-xl p-4 mb-3"
          style={{ background: 'var(--bg-card)', border: '1px solid var(--accent-dim)' }}
        >
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1 min-w-0">
              <div className="text-sm font-semibold mb-2" style={{ color: 'var(--accent-light)' }}>
                Personal Board에 오신 것을 환영합니다
              </div>
              <div className="space-y-1.5 text-[12px]" style={{ color: 'var(--text-muted)' }}>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] px-1.5 py-0.5 rounded font-mono flex-shrink-0" style={{ background: 'var(--bg-input)', border: '1px solid var(--border)' }}>TO-DO</span>
                  <span>날짜 아래 <b style={{ color: 'var(--text)' }}>+ 추가</b>를 눌러 할일을 등록하세요</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] px-1.5 py-0.5 rounded font-mono flex-shrink-0" style={{ background: 'var(--bg-input)', border: '1px solid var(--border)' }}>Timeline</span>
                  <span>타임라인 칸을 클릭해 시간 기록을 추가하세요</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] px-1.5 py-0.5 rounded font-mono flex-shrink-0" style={{ background: 'var(--bg-input)', border: '1px solid var(--border)' }}>★</span>
                  <span>헤더의 별표로 오늘의 하이라이트를 설정하세요</span>
                </div>
              </div>
            </div>
            <button
              onClick={dismissOnboarding}
              className="flex-shrink-0 px-3 py-1.5 rounded-lg text-xs font-medium transition-all"
              style={{ background: 'var(--accent-dim)', border: '1px solid var(--accent)', color: 'var(--accent-light)' }}
            >
              시작하기
            </button>
          </div>
        </div>
      )}

      {view === 'weekly' && <div
        key={currentWeekStart.toISOString()}
        ref={gridScrollRef}
        className={`flex-1 overflow-auto rounded-xl${slideDir === 'next' ? ' week-slide-next' : slideDir === 'prev' ? ' week-slide-prev' : ''}`}
        style={{ minWidth: 0, border: '1px solid var(--border)' }}
        onAnimationEnd={() => setSlideDir(null)}
      >
        <div style={{
          display: 'grid',
          gridTemplateColumns: isMobile ? '44px 1fr' : gridCols,
          minWidth: isMobile ? 0 : '760px',
        }}>

          {/* ── Day headers (sticky) ── */}
          <div
            className="sticky top-0 z-30"
            style={{ background: 'var(--bg-surface)', borderBottom: '1px solid var(--border)' }}
          />
          {visibleDays.map((day) => {
            const wi = weekDays.indexOf(day)
            const today = isToday(day)
            const dayKey = format(day, 'yyyy-MM-dd')
            const hasHighlight = highlights.some(x => x.date === dayKey)
            return (
              <div
                key={wi}
                className="sticky top-0 z-30 px-2 py-2"
                style={{
                  background: today ? 'rgba(139, 92, 246, 0.08)' : 'var(--bg-surface)',
                  borderLeft: '1px solid var(--border)',
                  borderBottom: '1px solid var(--border)',
                }}
              >
                {isMobile ? (
                  <div className="flex items-center justify-between">
                    <div className="flex items-baseline gap-1.5">
                      <span className="text-[11px] font-semibold" style={{ color: today ? 'var(--accent)' : 'var(--text-dim)' }}>{DAYS_KO[wi]}</span>
                      <span className="text-lg font-bold leading-none" style={{ color: today ? 'var(--accent-light)' : 'var(--text-bright)' }}>{format(day, 'd')}</span>
                    </div>
                    <button
                      onClick={() => setHighlightOpenDay(d => d === dayKey ? null : dayKey)}
                      className="text-sm leading-none px-1.5 py-0.5 rounded transition-all"
                      style={{
                        color: hasHighlight || highlightOpenDay === dayKey ? '#ca8a04' : 'rgba(202,138,4,0.3)',
                        background: highlightOpenDay === dayKey ? 'rgba(234,179,8,0.1)' : 'transparent',
                      }}
                    >★</button>
                  </div>
                ) : (
                  <>
                    <div className="text-[11px] font-semibold tracking-wide" style={{ color: today ? 'var(--accent)' : wi >= 5 ? 'var(--text-muted)' : 'var(--text-dim)' }}>{DAYS_KO[wi]}</div>
                    <div className="text-xl font-bold leading-tight" style={{ color: today ? 'var(--accent-light)' : 'var(--text-bright)' }}>{format(day, 'd')}</div>
                    <div className="text-[9px]" style={{ color: 'var(--text-dim)' }}>{format(day, 'MM/dd')}</div>
                  </>
                )}
              </div>
            )
          })}

          {/* ── Highlight section ── */}
          {!isMobile && (
            <div
              className="flex items-center justify-end pr-1.5"
              style={{ background: 'rgba(234,179,8,0.06)', borderBottom: '1px solid var(--border)', minHeight: 40 }}
            >
              <span className="text-[9px] tracking-widest font-semibold" style={{ color: '#ca8a04' }}>★</span>
            </div>
          )}
          {visibleDays.map((day) => {
            const dayKey = format(day, 'yyyy-MM-dd')
            const h = highlights.find(x => x.date === dayKey)
            const today = isToday(day)
            const isOpen = highlightOpenDay === dayKey
            if (isMobile && !h && !isOpen) return null
            return (
              <div key={`hl-${dayKey}`} style={isMobile ? { gridColumn: '1 / -1' } : undefined}>
                <HighlightCell
                  day={day}
                  dayKey={dayKey}
                  highlight={h}
                  today={today}
                  isMobile={isMobile}
                  isOpen={isOpen}
                  onClose={() => setHighlightOpenDay(null)}
                  onSet={setHighlight}
                  onToggle={toggleHighlight}
                  onDelete={deleteHighlight}
                />
              </div>
            )
          })}

          {/* ── To-do section ── */}
          <div
            className="flex items-center justify-end pr-1.5"
            style={{ background: 'var(--bg-card)', borderBottom: '1px solid var(--border)' }}
          >
            <span className="text-[9px] tracking-widest font-semibold" style={{ color: 'var(--text-dim)' }}>TO-DO</span>
          </div>
          {visibleDays.map((day) => {
            const wi = weekDays.indexOf(day)
            const dayKey = format(day, 'yyyy-MM-dd')
            const dayTodos = todosForDay(day)
            const isAdding = addingTodoDay === dayKey
            const today = isToday(day)
            return (
              <div
                key={wi}
                className="p-1.5"
                style={{
                  background: today ? 'rgba(139, 92, 246, 0.05)' : 'var(--bg-card)',
                  borderLeft: '1px solid var(--border)',
                  borderBottom: '1px solid var(--border)',
                }}
              >
                {loading ? (
                  <div className="space-y-1.5 p-1">
                    {[60, 80, 50].map((w, i) => (
                      <div
                        key={i}
                        className="h-2.5 rounded-full animate-pulse"
                        style={{ width: `${w}%`, background: 'var(--border)' }}
                      />
                    ))}
                  </div>
                ) : (
                  <div className="space-y-1">
                    {dayTodos.map(todo => (
                      <div
                        key={todo.id}
                        className="flex items-center gap-1.5 group px-1.5 py-1.5 rounded-lg transition-colors"
                        style={{ cursor: 'default' }}
                        onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-hover)')}
                        onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                      >
                        {/* 체크박스 */}
                        <button
                          onClick={() => toggleTodo(todo.id, todo.completed)}
                          className="w-4 h-4 rounded flex-shrink-0 flex items-center justify-center transition-all"
                          style={{
                            background: todo.completed ? 'var(--accent-dim)' : 'transparent',
                            border: `1.5px solid ${todo.completed ? 'var(--accent)' : 'var(--border)'}`,
                            cursor: 'pointer',
                          }}
                          onMouseEnter={e => {
                            e.currentTarget.style.borderColor = 'var(--accent)'
                            e.currentTarget.style.background = todo.completed ? 'var(--accent)' : 'var(--accent-dim)'
                          }}
                          onMouseLeave={e => {
                            e.currentTarget.style.borderColor = todo.completed ? 'var(--accent)' : 'var(--border)'
                            e.currentTarget.style.background = todo.completed ? 'var(--accent-dim)' : 'transparent'
                          }}
                        >
                          {todo.completed && <Check size={10} style={{ color: 'var(--accent-light)' }} />}
                        </button>
                        {/* 우선순위 점 */}
                        <div
                          className="w-2 h-2 rounded-full flex-shrink-0"
                          style={{
                            background: PRIORITY_COLOR[todo.priority] ?? PRIORITY_COLOR.medium,
                            opacity: todo.completed ? 0.3 : 0.8,
                          }}
                        />
                        <span
                          className="text-[12px] leading-snug flex-1 min-w-0 break-words"
                          style={{ color: todo.completed ? 'var(--text-dim)' : 'var(--text)', textDecoration: todo.completed ? 'line-through' : 'none' }}
                        >
                          {todo.title}
                        </span>
                        {/* 긴급 버튼 */}
                        <button
                          onClick={() => toggleUrgent(todo.id, todo.urgent)}
                          className={`flex-shrink-0 p-0.5 rounded transition-all ${todo.urgent ? 'opacity-100' : 'opacity-0 group-hover:opacity-60'}`}
                          style={{ color: todo.urgent ? '#ef4444' : 'var(--text-dim)', cursor: 'pointer' }}
                          title={todo.urgent ? '긴급 해제' : '긴급 표시'}
                          onMouseEnter={e => {
                            e.currentTarget.style.color = '#ef4444'
                            e.currentTarget.style.background = 'rgba(239,68,68,0.12)'
                            e.currentTarget.style.opacity = '1'
                          }}
                          onMouseLeave={e => {
                            e.currentTarget.style.color = todo.urgent ? '#ef4444' : 'var(--text-dim)'
                            e.currentTarget.style.background = 'transparent'
                          }}
                        >
                          <AlertCircle size={13} />
                        </button>
                        {/* 삭제 버튼 */}
                        <button
                          onClick={() => deleteTodo(todo.id)}
                          className="opacity-0 group-hover:opacity-70 transition-all flex-shrink-0 p-0.5 rounded"
                          style={{ color: 'var(--text-dim)', cursor: 'pointer' }}
                          title="삭제"
                          onMouseEnter={e => {
                            e.currentTarget.style.color = '#ef4444'
                            e.currentTarget.style.background = 'rgba(239,68,68,0.12)'
                            e.currentTarget.style.opacity = '1'
                          }}
                          onMouseLeave={e => {
                            e.currentTarget.style.color = 'var(--text-dim)'
                            e.currentTarget.style.background = 'transparent'
                          }}
                        >
                          <X size={13} />
                        </button>
                      </div>
                    ))}
                    {isAdding && !isMobile ? (
                      <div className="flex items-center gap-1.5 px-1">
                        <input
                          type="text"
                          value={newTodoTitle}
                          onChange={e => setNewTodoTitle(e.target.value)}
                          onKeyDown={e => {
                            if (e.key === 'Enter') submitTodo(day)
                            if (e.key === 'Escape') { setAddingTodoDay(null); setNewTodoTitle('') }
                          }}
                          placeholder="할일..."
                          className="flex-1 min-w-0 text-[12px] focus:outline-none rounded px-2 py-1"
                          style={{
                            background: 'var(--bg-input)',
                            border: '1px solid var(--accent-dim)',
                            color: 'var(--text)',
                          }}
                          autoFocus
                        />
                        <button
                          onClick={() => submitTodo(day)}
                          className="p-1 rounded transition-all"
                          style={{ color: 'var(--accent)', cursor: 'pointer' }}
                          onMouseEnter={e => { e.currentTarget.style.background = 'var(--accent-dim)' }}
                          onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}
                        >
                          <Check size={13} />
                        </button>
                        <button
                          onClick={() => { setAddingTodoDay(null); setNewTodoTitle('') }}
                          className="p-1 rounded transition-all"
                          style={{ color: 'var(--text-dim)', cursor: 'pointer' }}
                          onMouseEnter={e => { e.currentTarget.style.background = 'var(--bg-card)'; e.currentTarget.style.color = 'var(--text)' }}
                          onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--text-dim)' }}
                        >
                          <X size={13} />
                        </button>
                      </div>
                    ) : isAdding && isMobile ? (
                      <div
                        className="flex items-center gap-1 text-[11px] mt-0.5 px-1.5 py-1 rounded-lg"
                        style={{ color: 'var(--accent-light)', background: 'var(--accent-dim)' }}
                      >
                        <Plus size={12} /><span>입력 중...</span>
                      </div>
                    ) : (
                      <button
                        onClick={() => { setAddingTodoDay(dayKey); setNewTodoTitle('') }}
                        className="flex items-center gap-1 text-[11px] transition-all mt-0.5 px-1.5 py-1 rounded-lg w-full"
                        style={{ color: 'var(--text-dim)', cursor: 'pointer' }}
                        onMouseEnter={e => { e.currentTarget.style.background = 'var(--accent-dim)'; e.currentTarget.style.color = 'var(--accent-light)' }}
                        onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--text-dim)' }}
                      >
                        <Plus size={12} /><span>추가</span>
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
          {visibleDays.map((day) => {
            const di = weekDays.indexOf(day)
            const dateKey = format(day, 'yyyy-MM-dd')
            const dayEntries = entriesForDay(day)
            const dayGoogleEvents = googleEventsForDay(day)
            const today = isToday(day)
            const isAddingHere = addingEntry?.dateKey === dateKey

            // 겹치는 항목 레이아웃 계산 (로컬 + 구글 통합)
            const layoutItems = [
              ...dayEntries.map(e => ({ id: e.id, start: e.startTime, end: e.endTime || addOneHour(e.startTime) })),
              ...dayGoogleEvents.map(e => ({ id: `g_${e.id}`, start: format(new Date(e.start.dateTime), 'HH:mm'), end: format(new Date(e.end.dateTime), 'HH:mm') })),
            ]
            const layout = computeOverlapLayout(layoutItems)

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
                {dayGoogleEvents.map(event => {
                  const lv = layout.get(`g_${event.id}`)
                  return <GoogleEventBlock key={event.id} event={event} layoutCol={lv?.col} layoutTotal={lv?.total} />
                })}

                {/* Entries */}
                {dayEntries.map(entry => {
                  const lv = layout.get(entry.id)
                  return (
                    <EntryBlock
                      key={entry.id}
                      entry={entry}
                      onDelete={() => deleteEntry(entry.id)}
                      onDragStart={(e, type) => handleDragStart(e, entry, type)}
                      layoutCol={lv?.col}
                      layoutTotal={lv?.total}
                    />
                  )
                })}

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

// ── Highlight cell ──────────────────────────────────────────────────────────
function HighlightCell({
  day, dayKey, highlight, today,
  isMobile, isOpen, onClose,
  onSet, onToggle, onDelete,
}: {
  day: Date
  dayKey: string
  highlight: DailyHighlight | undefined
  today: boolean
  isMobile?: boolean
  isOpen?: boolean
  onClose?: () => void
  onSet: (date: string, content: string) => void
  onToggle: (h: DailyHighlight) => void
  onDelete: (date: string) => void
}) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (editing) inputRef.current?.focus()
  }, [editing])

  useEffect(() => {
    if (isOpen && !highlight) {
      setEditing(true)
      setDraft('')
    }
  }, [isOpen])

  const submit = () => {
    if (draft.trim()) onSet(dayKey, draft.trim())
    setEditing(false)
    setDraft('')
    onClose?.()
  }

  const cancel = () => {
    setEditing(false)
    setDraft('')
    onClose?.()
  }

  return (
    <div
      style={{
        background: today ? 'rgba(234,179,8,0.07)' : 'rgba(234,179,8,0.03)',
        borderLeft: '1px solid var(--border)',
        borderBottom: '1px solid var(--border)',
        padding: '4px 6px',
        minHeight: isMobile ? 0 : 40,
        display: 'flex', alignItems: 'center',
      }}
      onClick={() => { if (!highlight && !editing) { setEditing(true); setDraft('') } }}
    >
      {editing ? (
        <input
          ref={inputRef}
          value={draft}
          onChange={e => setDraft(e.target.value)}
          onClick={e => e.stopPropagation()}
          onKeyDown={e => {
            if (e.key === 'Enter') submit()
            if (e.key === 'Escape') cancel()
          }}
          onBlur={submit}
          placeholder="오늘의 하이라이트..."
          className="w-full text-[11px] focus:outline-none bg-transparent"
          style={{ color: 'var(--text)', borderBottom: '1px solid #ca8a04' }}
        />
      ) : highlight ? (
        <div className="flex items-center gap-1 w-full group">
          <button
            onClick={e => { e.stopPropagation(); onToggle(highlight) }}
            style={{
              width: 12, height: 12, borderRadius: '50%', flexShrink: 0,
              background: highlight.completed ? '#ca8a04' : 'transparent',
              border: '1.5px solid #ca8a04',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
          >
            {highlight.completed && <Check size={7} color="white" />}
          </button>
          <span
            className="text-[11px] flex-1 truncate cursor-pointer"
            style={{
              color: highlight.completed ? 'var(--text-dim)' : '#ca8a04',
              textDecoration: highlight.completed ? 'line-through' : 'none',
            }}
            onClick={e => { e.stopPropagation(); setEditing(true); setDraft(highlight.content) }}
          >
            {highlight.content}
          </span>
          <button
            onClick={e => { e.stopPropagation(); onDelete(dayKey) }}
            className="opacity-0 group-hover:opacity-100 transition-all flex-shrink-0"
            style={{ color: 'var(--text-dim)' }}
          >
            <X size={9} />
          </button>
        </div>
      ) : !isMobile ? (
        <span className="text-[10px]" style={{ color: 'rgba(202,138,4,0.35)' }}>+ 설정</span>
      ) : null}
    </div>
  )
}

// ── Matrix view ─────────────────────────────────────────────────────────────
const QUADRANTS = [
  { label: '지금 해', sub: '긴급 + 중요', urgent: true, important: true, color: '#ef4444', bg: 'rgba(239,68,68,0.06)' },
  { label: '일정 잡기', sub: '중요, 긴급 아님', urgent: false, important: true, color: '#3b82f6', bg: 'rgba(59,130,246,0.06)' },
  { label: '위임', sub: '긴급, 중요 아님', urgent: true, important: false, color: '#f59e0b', bg: 'rgba(245,158,11,0.06)' },
  { label: '제거', sub: '긴급 아님, 중요 아님', urgent: false, important: false, color: '#6b7280', bg: 'rgba(107,114,128,0.04)' },
]

function MatrixView({
  todos, weekLabel, isMobile,
  onToggle, onToggleUrgent, onDelete, onMove,
}: {
  todos: Todo[]
  weekLabel: string
  isMobile: boolean
  onToggle: (id: string, completed: boolean) => void
  onToggleUrgent: (id: string, urgent: boolean) => void
  onDelete: (id: string) => void
  onMove: (id: string, urgent: boolean, important: boolean) => void
}) {
  const [dragOver, setDragOver] = useState<number | null>(null)
  const [draggingId, setDraggingId] = useState<string | null>(null)

  const classify = (t: Todo) => ({ urgent: t.urgent, important: t.priority === 'high' })

  const handleDragStart = (e: React.DragEvent, todoId: string) => {
    e.dataTransfer.setData('todoId', todoId)
    e.dataTransfer.effectAllowed = 'move'
    setDraggingId(todoId)
  }

  const handleDrop = (e: React.DragEvent, qi: number) => {
    e.preventDefault()
    const todoId = e.dataTransfer.getData('todoId')
    const q = QUADRANTS[qi]
    if (todoId) onMove(todoId, q.urgent, q.important)
    setDragOver(null)
    setDraggingId(null)
  }

  return (
    <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
      {/* 축 라벨 — 데스크탑만 */}
      {!isMobile && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', marginBottom: 2 }}>
          <div className="text-center text-[10px] font-semibold" style={{ color: 'var(--text-dim)' }}>긴급함</div>
          <div className="text-center text-[10px] font-semibold" style={{ color: 'var(--text-dim)' }}>긴급하지 않음</div>
        </div>
      )}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr',
          gridTemplateRows: isMobile ? 'none' : '1fr 1fr',
          gap: 8,
          flex: isMobile ? undefined : 1,
          overflow: isMobile ? 'auto' : 'hidden',
        }}
      >
        {QUADRANTS.map((q, qi) => {
          const items = todos.filter(t => {
            const c = classify(t)
            return c.urgent === q.urgent && c.important === q.important
          })
          const isOver = dragOver === qi
          return (
            <div
              key={qi}
              onDragOver={e => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; setDragOver(qi) }}
              onDragLeave={e => { if (!e.currentTarget.contains(e.relatedTarget as Node)) setDragOver(null) }}
              onDrop={e => handleDrop(e, qi)}
              style={{
                background: isOver ? `${q.color}18` : q.bg,
                border: `${isOver ? 2 : 1}px solid ${isOver ? q.color : `${q.color}44`}`,
                borderRadius: 12, overflow: 'hidden',
                display: 'flex', flexDirection: 'column',
                transition: 'border 0.1s, background 0.1s',
              }}
            >
              <div style={{ padding: '10px 14px', borderBottom: `1px solid ${q.color}33`, background: `${q.color}10` }}>
                <div className="flex items-start gap-2">
                  <div style={{ width: 10, height: 10, borderRadius: '50%', background: q.color, flexShrink: 0, marginTop: 3 }} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-[14px]" style={{ color: q.color }}>{q.label}</span>
                      {items.length > 0 && (
                        <span className="ml-auto text-[11px] font-bold" style={{ color: q.color }}>{items.length}</span>
                      )}
                    </div>
                    <span className="text-[11px]" style={{ color: 'var(--text-dim)' }}>{q.sub}</span>
                  </div>
                </div>
              </div>
              <div style={{ flex: 1, overflowY: 'auto', padding: '8px 10px' }} className="space-y-1.5">
                {items.length === 0 ? (
                  <div
                    className="text-[13px] text-center pt-6"
                    style={{ color: isOver ? q.color : 'var(--text-dim)', opacity: isOver ? 0.7 : 0.4 }}
                  >
                    {isOver ? '여기에 놓기' : '없음'}
                  </div>
                ) : items.map(todo => (
                  <div
                    key={todo.id}
                    draggable
                    onDragStart={e => handleDragStart(e, todo.id)}
                    onDragEnd={() => { setDraggingId(null); setDragOver(null) }}
                    className="flex items-center gap-2 group px-3 py-2 rounded-xl"
                    style={{
                      background: 'var(--bg-card)',
                      opacity: draggingId === todo.id ? 0.4 : 1,
                      cursor: 'grab',
                      transition: 'opacity 0.15s',
                      minHeight: 40,
                    }}
                  >
                    <button
                      onClick={() => onToggle(todo.id, todo.completed)}
                      onMouseDown={e => e.stopPropagation()}
                      className="w-5 h-5 rounded flex-shrink-0 flex items-center justify-center"
                      style={{
                        background: todo.completed ? 'var(--accent-dim)' : 'transparent',
                        border: `1.5px solid ${todo.completed ? 'var(--accent)' : 'var(--border)'}`,
                        cursor: 'pointer',
                      }}
                    >
                      {todo.completed && <Check size={11} style={{ color: 'var(--accent-light)' }} />}
                    </button>
                    <div
                      className="w-2 h-2 rounded-full flex-shrink-0"
                      style={{ background: PRIORITY_COLOR[todo.priority] ?? PRIORITY_COLOR.medium, opacity: 0.8 }}
                    />
                    <span
                      className="text-[13px] flex-1 truncate"
                      style={{ color: todo.completed ? 'var(--text-dim)' : 'var(--text)', textDecoration: todo.completed ? 'line-through' : 'none' }}
                    >
                      {todo.title}
                    </span>
                    {todo.date && (
                      <span className="text-[11px] flex-shrink-0" style={{ color: 'var(--text-dim)' }}>
                        {format(new Date(todo.date), 'M/d')}
                      </span>
                    )}
                    <button
                      onClick={() => onToggleUrgent(todo.id, todo.urgent)}
                      className={`flex-shrink-0 p-1 rounded transition-all ${todo.urgent ? 'opacity-100' : 'opacity-0 group-hover:opacity-60'}`}
                      style={{ color: todo.urgent ? '#ef4444' : 'var(--text-dim)', cursor: 'pointer' }}
                      title={todo.urgent ? '긴급 해제' : '긴급 표시'}
                    >
                      <AlertCircle size={15} />
                    </button>
                    <button
                      onClick={() => onDelete(todo.id)}
                      className="opacity-0 group-hover:opacity-100 flex-shrink-0 p-1 rounded transition-all"
                      style={{ color: 'var(--text-dim)', cursor: 'pointer' }}
                      title="삭제"
                    >
                      <X size={15} />
                    </button>
                  </div>
                ))}
                {/* 드래그 중 빈 공간에도 drop 가능하도록 패딩 영역 */}
                {draggingId && items.length > 0 && isOver && (
                  <div
                    style={{
                      height: 40, borderRadius: 10, border: `2px dashed ${q.color}66`,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}
                  >
                    <span className="text-[12px]" style={{ color: q.color }}>여기에 놓기</span>
                  </div>
                )}
              </div>
            </div>
          )
        })}
      </div>
      <div className="mt-2 text-center text-[10px]" style={{ color: 'var(--text-dim)' }}>
        {weekLabel} · 카드를 드래그해서 분면 이동 · 중요 = priority high · ! 클릭으로 긴급 표시
      </div>
    </div>
  )
}
