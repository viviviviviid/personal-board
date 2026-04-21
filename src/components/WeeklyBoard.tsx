'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useSwipe } from '@/hooks/useSwipe'
import { format, addWeeks, subWeeks, startOfWeek, addDays, isSameDay, isToday, addMonths, subMonths, startOfMonth } from 'date-fns'
import { useSidebar } from '@/context/SidebarContext'
import { ChevronLeft, ChevronRight, Plus, Check, X, CalendarDays, RefreshCw, Unlink, AlertCircle } from 'lucide-react'
import { signIn } from 'next-auth/react'
import AIPanel from './AIPanel'
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
  start: { dateTime?: string; date?: string }
  end: { dateTime?: string; date?: string }
  calendarId: string
  calendarColor: string
  allDay?: boolean
}

interface Todo {
  id: string
  title: string
  completed: boolean
  priority: string
  urgent: boolean
  date: string | null
  recurringRuleId?: string | null
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
  recurringRuleId?: string | null
}

// ── Constants ──────────────────────────────────────────────────────────────
const HOURS = Array.from({ length: LAST_HOUR - FIRST_HOUR + 1 }, (_, i) => i + FIRST_HOUR)
const DAYS_KO = ['월', '화', '수', '목', '금', '토', '일']
const dayOfWeekIdx = (d: Date) => { const g = d.getDay(); return g === 0 ? 6 : g - 1 }

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


// ── Recurring repeat picker ─────────────────────────────────────────────────
type RecurringFreq = 'daily' | 'weekdays' | 'weekly' | 'monthly'

const FREQ_LABELS: { val: RecurringFreq; label: string }[] = [
  { val: 'daily', label: '매일' },
  { val: 'weekdays', label: '평일' },
  { val: 'weekly', label: '요일별' },
  { val: 'monthly', label: '매달' },
]

const DAY_BUTTONS = [
  { iso: 1, label: '월' }, { iso: 2, label: '화' }, { iso: 3, label: '수' },
  { iso: 4, label: '목' }, { iso: 5, label: '금' }, { iso: 6, label: '토' }, { iso: 7, label: '일' },
]

function RepeatPicker({
  freq, weekDays, onFreqChange, onWeekDayToggle,
}: {
  freq: RecurringFreq
  weekDays: number[]
  onFreqChange: (f: RecurringFreq) => void
  onWeekDayToggle: (iso: number) => void
}) {
  return (
    <div className="flex flex-col gap-1 mt-1">
      <div className="flex gap-1 flex-wrap">
        {FREQ_LABELS.map(({ val, label }) => (
          <button
            key={val}
            type="button"
            onClick={e => { e.stopPropagation(); onFreqChange(val) }}
            className="text-[10px] px-2 py-0.5 rounded"
            style={{
              background: freq === val ? 'var(--accent-dim)' : 'var(--bg-input)',
              color: freq === val ? 'var(--accent-light)' : 'var(--text-dim)',
              border: `1px solid ${freq === val ? 'var(--accent)' : 'var(--border)'}`,
            }}
          >
            {label}
          </button>
        ))}
      </div>
      {freq === 'weekly' && (
        <div className="flex gap-1">
          {DAY_BUTTONS.map(({ iso, label }) => (
            <button
              key={iso}
              type="button"
              onClick={e => { e.stopPropagation(); onWeekDayToggle(iso) }}
              className="text-[10px] w-6 h-6 rounded"
              style={{
                background: weekDays.includes(iso) ? 'var(--accent-dim)' : 'var(--bg-input)',
                color: weekDays.includes(iso) ? 'var(--accent-light)' : 'var(--text-dim)',
                border: `1px solid ${weekDays.includes(iso) ? 'var(--accent)' : 'var(--border)'}`,
              }}
            >
              {label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Entry block ────────────────────────────────────────────────────────────
interface EntryBlockProps {
  entry: TimelineEntry
  onDelete: () => void
  onDragStart: (e: React.MouseEvent, type: 'move' | 'resize') => void
  onSelect: (entry: TimelineEntry, rect: DOMRect) => void
  layoutCol?: number
  layoutTotal?: number
}

function EntryBlock({ entry, onDelete, onDragStart, onSelect, layoutCol = 0, layoutTotal = 1 }: EntryBlockProps) {
  const top = timeToY(entry.startTime)
  const effEnd = entry.endTime || addOneHour(entry.startTime)
  const height = Math.max(20, timeToY(effEnd) - top)
  const s = CAT_STYLE[entry.category || ''] ?? DEF_STYLE
  const didDragRef = useRef(false)

  const GAP = 2
  const pct = 100 / layoutTotal
  const colLeft = `calc(${layoutCol * pct}% + ${GAP}px)`
  const colWidth = `calc(${pct}% - ${GAP * 2}px)`

  return (
    <div
      style={{
        position: 'absolute', top, left: colLeft, width: colWidth, height, zIndex: 30,
        background: s.bg, border: `1px solid ${s.border}`, color: s.text,
        borderRadius: 6,
      }}
      className="text-[10px] overflow-hidden group select-none"
      onMouseDown={e => {
        e.stopPropagation()
        didDragRef.current = false
        onDragStart(e, 'move')
      }}
      onClick={e => {
        e.stopPropagation()
        if (didDragRef.current) return
        const rect = e.currentTarget.getBoundingClientRect()
        onSelect(entry, rect)
      }}
    >
      <div className="px-1.5 pt-0.5 pb-4 h-full overflow-hidden cursor-grab active:cursor-grabbing">
        <div className="font-mono text-[9px] opacity-55 tabular-nums leading-none">
          {entry.startTime}{entry.endTime ? ` – ${entry.endTime}` : ''}
        </div>
        <div className="mt-0.5 leading-tight font-medium truncate">
          {entry.recurringRuleId && <span style={{ fontSize: 8, opacity: 0.6, marginRight: 2 }}>🔁</span>}
          {entry.title}
        </div>
      </div>
      {/* resize handle */}
      <div
        style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 10, cursor: 'ns-resize' }}
        className="flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
        onMouseDown={e => { e.stopPropagation(); didDragRef.current = true; onDragStart(e, 'resize') }}
      >
        <div className="w-8 h-[2px] rounded-full bg-current opacity-40" />
      </div>
    </div>
  )
}

// ── Entry detail popover ────────────────────────────────────────────────────
const CAT_LABEL: Record<string, string> = {
  work: '업무', personal: '개인', exercise: '운동', study: '학습', health: '건강', other: '기타',
}

interface EntryDetailPopoverProps {
  entry: TimelineEntry
  anchorRect: DOMRect
  onClose: () => void
  onUpdated: (updated: TimelineEntry) => void
  onDeleted: (id: string, mode: 'single' | 'future' | 'all') => void
}

function EntryDetailPopover({ entry, anchorRect, onClose, onUpdated, onDeleted }: EntryDetailPopoverProps) {
  const [editing, setEditing] = useState(false)
  const [title, setTitle] = useState(entry.title)
  const [startTime, setStartTime] = useState(entry.startTime)
  const [endTime, setEndTime] = useState(entry.endTime ?? '')
  const [category, setCategory] = useState(entry.category ?? '')
  const [saving, setSaving] = useState(false)
  const [recurringAction, setRecurringAction] = useState<'edit' | 'delete' | null>(null)

  // 팝오버 위치: 오른쪽 공간 부족하면 왼쪽, 화면 안으로 클램핑
  const popWidth = 220
  const rawLeft = anchorRect.right + 8 + popWidth > window.innerWidth
    ? anchorRect.left - popWidth - 8
    : anchorRect.right + 8
  const left = Math.max(8, Math.min(rawLeft, window.innerWidth - popWidth - 8))
  const top = Math.max(8, Math.min(anchorRect.top, window.innerHeight - 320))

  const handleSave = async (mode: 'single' | 'all') => {
    setSaving(true)
    const res = await fetch(`/api/timeline/${entry.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title, startTime, endTime: endTime || null, category: category || null, mode }),
    })
    if (res.ok) {
      const updated = await res.json()
      onUpdated({ ...entry, title, startTime, endTime: endTime || null, category: category || null, ...(updated.success ? {} : updated) })
      setEditing(false)
      setRecurringAction(null)
      if (mode === 'all') onClose()
    }
    setSaving(false)
  }

  const handleDelete = async (mode: 'single' | 'future' | 'all') => {
    await fetch(`/api/timeline/${entry.id}?mode=${mode}`, { method: 'DELETE' })
    onDeleted(entry.id, mode)
    onClose()
  }

  return (
    <>
      {/* backdrop */}
      <div className="fixed inset-0 z-[9998]" onClick={onClose} />

      {/* popover */}
      <div
        style={{
          position: 'fixed', top, left, width: popWidth, zIndex: 9999,
          background: 'var(--bg-card)',
          border: '1px solid var(--border)',
          borderRadius: 12,
          boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* 색상 바 */}
        <div style={{ height: 3, borderRadius: '12px 12px 0 0', background: CAT_STYLE[entry.category || '']?.border ?? 'var(--accent)' }} />

        <div className="p-3">
          {/* 헤더 */}
          <div className="flex items-start justify-between gap-2 mb-3">
            <div className="flex-1 min-w-0">
              {editing ? (
                <input
                  autoFocus
                  value={title}
                  onChange={e => setTitle(e.target.value)}
                  onKeyDown={e => { if (e.nativeEvent.isComposing) return; if (e.key === 'Escape') { setEditing(false); setRecurringAction(null) } }}
                  className="w-full text-sm font-semibold bg-transparent border-b focus:outline-none"
                  style={{ borderColor: 'var(--accent)', color: 'var(--text-bright)' }}
                />
              ) : (
                <div className="text-sm font-semibold leading-tight" style={{ color: 'var(--text-bright)' }}>
                  {entry.recurringRuleId && <span className="text-[10px] mr-1 opacity-50">🔁</span>}
                  {entry.title}
                </div>
              )}
            </div>
            <button onClick={onClose} style={{ color: 'var(--text-dim)', flexShrink: 0 }}>
              <X size={14} />
            </button>
          </div>

          {/* 시간 / 카테고리 */}
          {editing ? (
            <div className="space-y-1.5 mb-3">
              <div className="flex gap-1 items-center">
                <input
                  value={startTime}
                  onChange={e => setStartTime(e.target.value)}
                  placeholder="시작"
                  className="w-16 text-[11px] rounded px-1.5 py-0.5 focus:outline-none"
                  style={{ background: 'var(--bg-input)', border: '1px solid var(--border)', color: 'var(--text)' }}
                />
                <span className="text-[10px]" style={{ color: 'var(--text-dim)' }}>~</span>
                <input
                  value={endTime}
                  onChange={e => setEndTime(e.target.value)}
                  placeholder="종료"
                  className="w-16 text-[11px] rounded px-1.5 py-0.5 focus:outline-none"
                  style={{ background: 'var(--bg-input)', border: '1px solid var(--border)', color: 'var(--text)' }}
                />
              </div>
              <select
                value={category}
                onChange={e => setCategory(e.target.value)}
                className="w-full text-[11px] rounded px-1.5 py-0.5 focus:outline-none"
                style={{ background: 'var(--bg-input)', border: '1px solid var(--border)', color: 'var(--text-muted)' }}
              >
                <option value="">카테고리 없음</option>
                <option value="work">업무</option>
                <option value="personal">개인</option>
                <option value="exercise">운동</option>
                <option value="study">학습</option>
                <option value="health">건강</option>
                <option value="other">기타</option>
              </select>
            </div>
          ) : (
            <div className="mb-3 space-y-1">
              <div className="text-xs" style={{ color: 'var(--text-muted)' }}>
                {entry.startTime}{entry.endTime ? ` – ${entry.endTime}` : ''}
              </div>
              {entry.category && (
                <div className="text-xs" style={{ color: 'var(--text-dim)' }}>
                  {CAT_LABEL[entry.category] ?? entry.category}
                </div>
              )}
            </div>
          )}

          {/* 반복 옵션 다이얼로그 */}
          {recurringAction && (
            <div className="mb-3 rounded-lg p-2.5 space-y-1.5" style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-dim)' }}>
              <div className="text-[10px] font-medium mb-2" style={{ color: 'var(--text-muted)' }}>
                {recurringAction === 'delete' ? '어떤 일정을 삭제할까요?' : '어떤 일정을 수정할까요?'}
              </div>
              {(['single', 'future', 'all'] as const)
                .filter(m => recurringAction === 'edit' ? m !== 'future' : true)
                .map(m => (
                  <button
                    key={m}
                    onClick={() => recurringAction === 'delete' ? handleDelete(m) : handleSave(m as 'single' | 'all')}
                    disabled={saving}
                    className="w-full text-left text-[11px] px-2 py-1.5 rounded transition-colors"
                    style={{ color: 'var(--text)', background: 'transparent' }}
                    onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-card)')}
                    onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                  >
                    {m === 'single' ? '이 일정만' : m === 'future' ? '이 일정 및 이후 일정' : '모든 일정'}
                  </button>
                ))
              }
              <button
                onClick={() => setRecurringAction(null)}
                className="w-full text-left text-[11px] px-2 py-1 rounded"
                style={{ color: 'var(--text-dim)' }}
              >
                취소
              </button>
            </div>
          )}

          {/* 액션 버튼 */}
          {!recurringAction && (
            <div className="flex gap-1.5 justify-end">
              {editing ? (
                <>
                  <button
                    onClick={() => { setEditing(false); setTitle(entry.title); setStartTime(entry.startTime); setEndTime(entry.endTime ?? ''); setCategory(entry.category ?? '') }}
                    className="text-[11px] px-2.5 py-1 rounded-lg"
                    style={{ color: 'var(--text-dim)', border: '1px solid var(--border)' }}
                  >
                    취소
                  </button>
                  <button
                    onClick={() => entry.recurringRuleId ? setRecurringAction('edit') : handleSave('single')}
                    disabled={saving}
                    className="text-[11px] px-2.5 py-1 rounded-lg"
                    style={{ background: 'var(--accent)', color: '#fff' }}
                  >
                    {saving ? '저장 중…' : '저장'}
                  </button>
                </>
              ) : (
                <>
                  <button
                    onClick={() => entry.recurringRuleId ? setRecurringAction('delete') : handleDelete('single')}
                    className="text-[11px] px-2.5 py-1 rounded-lg"
                    style={{ color: 'var(--danger)', border: '1px solid rgba(239,68,68,0.3)' }}
                  >
                    삭제
                  </button>
                  <button
                    onClick={() => setEditing(true)}
                    className="text-[11px] px-2.5 py-1 rounded-lg"
                    style={{ background: 'var(--accent-dim)', color: 'var(--accent-light)', border: '1px solid var(--accent)' }}
                  >
                    수정
                  </button>
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </>
  )
}

// ── Google Event block ──────────────────────────────────────────────────────
// 멀티데이 timed 이벤트를 해당 날짜 범위로 클리핑
function clipTimedEvent(event: GoogleCalendarEvent, day: Date): { startTime: string; endTime: string } {
  const dayStr = format(day, 'yyyy-MM-dd')
  const evStart = new Date(event.start.dateTime!)
  const evEnd = new Date(event.end.dateTime!)
  const startTime = format(evStart, 'yyyy-MM-dd') === dayStr
    ? format(evStart, 'HH:mm')
    : `${String(FIRST_HOUR).padStart(2, '0')}:00`
  const endTime = format(evEnd, 'yyyy-MM-dd') === dayStr
    ? format(evEnd, 'HH:mm')
    : `${String(LAST_HOUR).padStart(2, '0')}:59`
  return { startTime, endTime }
}

function GoogleEventBlock({ event, layoutCol = 0, layoutTotal = 1, effectiveStart, effectiveEnd }: {
  event: GoogleCalendarEvent; layoutCol?: number; layoutTotal?: number;
  effectiveStart?: string; effectiveEnd?: string;
}) {
  const startTime = effectiveStart ?? format(new Date(event.start.dateTime!), 'HH:mm')
  const endTime = effectiveEnd ?? format(new Date(event.end.dateTime!), 'HH:mm')
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
        position: 'absolute', top, left: colLeft, width: colWidth, height, zIndex: 29,
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
  const [mobileDayCols, setMobileDayCols] = useState(2)
  const [desktopDayCols, setDesktopDayCols] = useState(7)
  const [desktopViewStart, setDesktopViewStart] = useState(() => startOfWeek(new Date(), { weekStartsOn: 1 }))
  const { isCollapsed } = useSidebar()
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
  const [topSectionHeight, setTopSectionHeight] = useState(0)
  const gridScrollRef = useRef<HTMLDivElement>(null)

  const [addingTodoDay, setAddingTodoDay] = useState<string | null>(null)
  const [highlightOpenDay, setHighlightOpenDay] = useState<string | null>(null)
  const [newTodoTitle, setNewTodoTitle] = useState('')
  const [editingTodoId, setEditingTodoId] = useState<string | null>(null)
  const [editingTodoTitle, setEditingTodoTitle] = useState('')
  const [activeTodoId, setActiveTodoId] = useState<string | null>(null)
  const [expandedTodoDays, setExpandedTodoDays] = useState<Set<string>>(new Set())
  const [selectedEntry, setSelectedEntry] = useState<{ entry: TimelineEntry; rect: DOMRect } | null>(null)
  const [addingEntry, setAddingEntry] = useState<{ dateKey: string; hour: number; startTime?: string } | null>(null)
  const [newEntry, setNewEntry] = useState({ title: '', endTime: '', category: '' })
  const [creationDrag, setCreationDrag] = useState<{ dateKey: string; topY: number; bottomY: number } | null>(null)
  const creationDragRef = useRef<{ dateKey: string; day: Date; startY: number; startMouseY: number; columnTop: number } | null>(null)

  // Repeat state
  const [todoRepeat, setTodoRepeat] = useState(false)
  const [todoFreq, setTodoFreq] = useState<RecurringFreq>('daily')
  const [todoWeekDays, setTodoWeekDays] = useState<number[]>([])
  const [entryRepeat, setEntryRepeat] = useState(false)
  const [entryFreq, setEntryFreq] = useState<RecurringFreq>('daily')
  const [entryWeekDays, setEntryWeekDays] = useState<number[]>([])
  const [entryCreateTodo, setEntryCreateTodo] = useState(false)
  const [entryHideMonthly, setEntryHideMonthly] = useState(false)
  const [onboardingDone, setOnboardingDone] = useState(true) // default true — localStorage로 덮어씀

  useEffect(() => {
    if (!localStorage.getItem('pb-onboarding-done')) setOnboardingDone(false)
  }, [])

  // Click outside → deactivate active todo options
  useEffect(() => {
    if (!activeTodoId) return
    const handler = (e: MouseEvent) => {
      const target = e.target as HTMLElement
      if (!target.closest('[data-todo-row]')) setActiveTodoId(null)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [activeTodoId])

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

  // Persist mobileDayCols
  useEffect(() => {
    const saved = localStorage.getItem('board-mobile-cols')
    if (saved && Number(saved) >= 1) setMobileDayCols(Number(saved))
  }, [])

  const setMobileDayColsPersist = (n: number) => {
    setMobileDayCols(n)
    localStorage.setItem('board-mobile-cols', String(n))
  }

  // Auto-detect desktopDayCols from content width (window - sidebar)
  useEffect(() => {
    if (isMobile) return
    const update = () => {
      const sidebarW = isCollapsed ? 48 : 240
      const contentW = window.innerWidth - sidebarW
      if (contentW < 850) setDesktopDayCols(3)
      else if (contentW < 1300) setDesktopDayCols(5)
      else setDesktopDayCols(7)
    }
    update()
    window.addEventListener('resize', update)
    return () => window.removeEventListener('resize', update)
  }, [isMobile, isCollapsed])

  // 7-col 또는 모바일에서는 desktopViewStart를 currentWeekStart에 동기화
  useEffect(() => {
    if (desktopDayCols === 7 || isMobile) {
      setDesktopViewStart(currentWeekStart)
    }
  }, [currentWeekStart, desktopDayCols, isMobile])

  const setDesktopDayColsPersist = (n: number) => {
    setDesktopDayCols(n)
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
    if (!isMobile && desktopDayCols < 7) {
      // 5/3-col: 슬라이딩 윈도우 — desktopDayCols 일만큼 이동
      setDesktopViewStart(d => dir === 'next' ? addDays(d, desktopDayCols) : addDays(d, -desktopDayCols))
    } else {
      setCurrentWeekStart(d => dir === 'next' ? addWeeks(d, 1) : subWeeks(d, 1))
    }
  }, [isMobile, desktopDayCols])

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

  // 타임라인 스크롤 초기 위치 — outerScrollRef가 전체 스크롤 담당
  useEffect(() => {
    const outer = outerScrollRef.current
    const topSection = topSectionRef.current
    if (!outer || !topSection) return

    const height = topSection.offsetHeight
    setTopSectionHeight(height)

    const DEFAULT_HOUR = 9
    const defaultY = (DEFAULT_HOUR - FIRST_HOUR) * ROW_H  // 9시 = 208px

    // 현재 시간이 이번 주에 보이는지 확인
    const todayInWeek = weekDays.some(d => isToday(d))
    const currentNowY = nowToY(now)

    // 모바일: 선택된 날짜, 데스크탑: 주 첫날 기준
    const targetDay = isMobile ? weekDays[mobileDay] : weekDays[0]
    const dayEntries = timeline
      .filter(e => isSameDay(new Date(e.date), targetDay))
      .sort((a, b) => a.startTime.localeCompare(b.startTime))

    // 항상 맨 위(투두)부터 보이도록 시작
    const timelineY = 0

    // topSection 높이 + 타임라인 내 위치 = outer 스크롤 목표
    const scrollTop = height + timelineY

    const timer = setTimeout(() => {
      outer.scrollTo({ top: scrollTop, behavior: 'instant' as ScrollBehavior })
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
      if (view !== 'weekly') return
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

  const outerScrollRef = useRef<HTMLDivElement>(null)
  const topSectionRef = useRef<HTMLDivElement>(null)
  const columnRefs = useRef<(HTMLDivElement | null)[]>([])
  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(currentWeekStart, i))

  // ── Fetch ────────────────────────────────────────────────────────────────
  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const isSliding = !isMobile && desktopDayCols < 7
      const rangeStart = isSliding ? desktopViewStart : currentWeekStart
      const rangeLen = isSliding ? desktopDayCols : 7
      const startStr = format(rangeStart, 'yyyy-MM-dd')
      const endStr = format(addDays(rangeStart, rangeLen - 1), 'yyyy-MM-dd')
      const timeMin = rangeStart.toISOString()
      const timeMax = addDays(rangeStart, rangeLen).toISOString()

      // 하이라이트 fetch — week 파라미터로 rangeStart부터 7일 커버
      fetch(`/api/daily-highlight?week=${startStr}`)
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
        fetch(`/api/todos?startDate=${startStr}&endDate=${endStr}`),
        fetch(`/api/timeline?startDate=${startStr}&endDate=${endStr}`),
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
  }, [currentWeekStart, desktopViewStart, desktopDayCols, isMobile, weeklyEnabledCals, calendarList])

  useEffect(() => { fetchData() }, [fetchData])

  // ── Handlers ─────────────────────────────────────────────────────────────
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
    const target = todos.find(t => t.id === id)
    if (target?.recurringRuleId) {
      setTodos(prev => prev.filter(t => t.recurringRuleId !== target.recurringRuleId))
    } else {
      setTodos(prev => prev.filter(t => t.id !== id))
    }
    await fetch(`/api/todos/${id}`, { method: 'DELETE' }).catch(() => fetchData())
  }

  const startEditTodo = (todo: Todo) => {
    setEditingTodoId(todo.id)
    setEditingTodoTitle(todo.title)
  }

  const commitEditTodo = async (todo: Todo) => {
    const newTitle = editingTodoTitle.trim()
    setEditingTodoId(null)
    if (!newTitle || newTitle === todo.title) return
    await fetch(`/api/todos/${todo.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: newTitle }),
    })
    setTodos(prev => prev.map(t => t.id === todo.id ? { ...t, title: newTitle } : t))
  }

  const submitTodo = async (day: Date) => {
    if (!newTodoTitle.trim()) { setAddingTodoDay(null); return }

    if (todoRepeat) {
      const title = newTodoTitle.trim()
      setNewTodoTitle('')
      setAddingTodoDay(null)
      setTodoRepeat(false)
      const wd = todoFreq === 'weekly' && todoWeekDays.length === 0
        ? [day.getDay() === 0 ? 7 : day.getDay()]
        : todoWeekDays
      await fetch('/api/todos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title, date: format(day, 'yyyy-MM-dd'), recurring: true, freq: todoFreq,
          weekDays: todoFreq === 'weekly' ? wd : undefined,
          monthDay: todoFreq === 'monthly' ? day.getDate() : undefined,
        }),
      })
      fetchData()
      return
    }

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

  const submitEntry = async (day: Date, hour: number, overrideStartTime?: string) => {
    if (!newEntry.title.trim()) { setAddingEntry(null); return }
    const startTime = overrideStartTime ?? `${String(hour).padStart(2, '0')}:00`

    if (entryRepeat) {
      const title = newEntry.title.trim()
      const endTime = newEntry.endTime || addOneHour(startTime)
      const category = newEntry.category || undefined
      const shouldCreateTodo = entryCreateTodo
      const hideFromMonthly = entryHideMonthly
      setNewEntry({ title: '', endTime: '', category: '' })
      setAddingEntry(null)
      setEntryRepeat(false)
      setEntryCreateTodo(false)
      setEntryHideMonthly(false)
      const wd = entryFreq === 'weekly' && entryWeekDays.length === 0
        ? [day.getDay() === 0 ? 7 : day.getDay()]
        : entryWeekDays
      await fetch('/api/timeline', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          date: format(day, 'yyyy-MM-dd'), startTime, endTime, title, category,
          recurring: true, freq: entryFreq,
          weekDays: entryFreq === 'weekly' ? wd : undefined,
          monthDay: entryFreq === 'monthly' ? day.getDate() : undefined,
          hideFromMonthly,
        }),
      })
      if (shouldCreateTodo) {
        await fetch('/api/todos', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            title, date: format(day, 'yyyy-MM-dd'),
            recurring: true, freq: entryFreq,
            weekDays: entryFreq === 'weekly' ? wd : undefined,
            monthDay: entryFreq === 'monthly' ? day.getDate() : undefined,
          }),
        })
      }
      fetchData()
      return
    }

    const tempId = `temp-${Date.now()}`
    const entry: TimelineEntry = {
      id: tempId, date: day.toISOString(), startTime,
      endTime: newEntry.endTime || addOneHour(startTime),
      title: newEntry.title.trim(), category: newEntry.category || null,
    }
    const shouldCreateTodo = entryCreateTodo
    const hideFromMonthly = entryHideMonthly
    setTimeline(prev => [...prev, entry])
    setNewEntry({ title: '', endTime: '', category: '' })
    setAddingEntry(null)
    setEntryCreateTodo(false)
    setEntryHideMonthly(false)
    try {
      const res = await fetch('/api/timeline', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          date: format(day, 'yyyy-MM-dd'), startTime,
          endTime: entry.endTime, title: entry.title,
          category: entry.category || undefined,
          hideFromMonthly,
        }),
      })
      const created = await res.json()
      setTimeline(prev => prev.map(e => e.id === tempId ? created : e))
      if (shouldCreateTodo) {
        const todoRes = await fetch('/api/todos', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ title: entry.title, date: format(day, 'yyyy-MM-dd') }),
        })
        if (todoRes.ok) {
          const todo = await todoRes.json()
          setTodos(prev => [...prev, todo])
        }
      }
    } catch {
      setTimeline(prev => prev.filter(e => e.id !== tempId))
    }
  }

  const deleteEntry = async (id: string) => {
    const target = timeline.find(e => e.id === id)
    if (target?.recurringRuleId) {
      setTimeline(prev => prev.filter(e => e.recurringRuleId !== target.recurringRuleId))
    } else {
      setTimeline(prev => prev.filter(e => e.id !== id))
    }
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
  const todosForDay = (day: Date) => {
    const filtered = todos.filter(t => t.date && isSameDay(new Date(t.date), day))
    return [...filtered].sort((a, b) => Number(a.completed) - Number(b.completed))
  }
  const entriesForDay = (day: Date) =>
    timeline.filter(e => isSameDay(new Date(e.date), day))
  const googleEventsForDay = (day: Date) => {
    const dayStr = format(day, 'yyyy-MM-dd')
    return googleEvents.filter(e => {
      if (e.allDay) return false
      const startDay = format(new Date(e.start.dateTime!), 'yyyy-MM-dd')
      const endDt = new Date(e.end.dateTime!)
      const endDay = endDt.getHours() === 0 && endDt.getMinutes() === 0
        ? format(addDays(endDt, -1), 'yyyy-MM-dd')
        : format(endDt, 'yyyy-MM-dd')
      return startDay <= dayStr && dayStr <= endDay
    })
  }
  const allDayGoogleEventsForDay = (day: Date) => {
    const dayStr = format(day, 'yyyy-MM-dd')
    return googleEvents.filter(e => e.allDay && !!e.start.date && !!e.end.date && e.start.date <= dayStr && dayStr < e.end.date)
  }
  const weekLabel = (!isMobile && desktopDayCols < 7)
    ? `${format(desktopViewStart, 'yyyy.MM.dd')} — ${format(addDays(desktopViewStart, desktopDayCols - 1), 'MM.dd')}`
    : `${format(currentWeekStart, 'yyyy.MM.dd')} — ${format(addDays(currentWeekStart, 6), 'MM.dd')}`
  const monthLabel = monthCount === 1
    ? format(currentMonth, 'yyyy년 M월')
    : `${format(currentMonth, 'yyyy.MM')} — ${format(addMonths(currentMonth, monthCount - 1), 'yyyy.MM')}`
  const nowY = nowToY(now)
  const mobileStart = isMobile ? Math.min(mobileDay, Math.max(0, 7 - mobileDayCols)) : 0
  const visibleDays = isMobile
    ? weekDays.slice(mobileStart, mobileStart + mobileDayCols)
    : desktopDayCols < 7
      ? Array.from({ length: desktopDayCols }, (_, i) => addDays(desktopViewStart, i))
      : weekDays.slice(0, 7)
  const colCount = visibleDays.length
  const gridCols = `32px repeat(${colCount}, minmax(0, 1fr))`
  const gridMinWidth = isMobile ? 0 : Math.max(320, colCount * 130 + 32)

  // 동적 타임라인 높이 계산 (24시 이후 콘텐츠 있을 때만 확장)
  const calculateTimelineHeight = useCallback(() => {
    let maxHour = LAST_HOUR
    for (const day of visibleDays) {
      const entries = entriesForDay(day)
      const dayGoogleEvents = googleEventsForDay(day)

      for (const entry of entries) {
        const endTime = entry.endTime || addOneHour(entry.startTime)
        const h = parseInt(endTime.split(':')[0])
        maxHour = Math.max(maxHour, h)
      }

      for (const event of dayGoogleEvents) {
        const h = new Date(event.end.dateTime!).getHours()
        maxHour = Math.max(maxHour, h)
      }
    }
    return (maxHour - FIRST_HOUR + 1) * ROW_H
  }, [visibleDays, timeline, googleEvents])

  const timelineHeight = calculateTimelineHeight()

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }} {...swipeHandlers}>

      {/* Entry detail popover */}
      {selectedEntry && (
        <EntryDetailPopover
          entry={selectedEntry.entry}
          anchorRect={selectedEntry.rect}
          onClose={() => setSelectedEntry(null)}
          onUpdated={updated => {
            setTimeline(prev => prev.map(t => t.id === updated.id ? updated : t))
            setSelectedEntry(null)
          }}
          onDeleted={(id, mode) => {
            if (mode === 'all') {
              const ruleId = selectedEntry.entry.recurringRuleId
              setTimeline(prev => prev.filter(t => ruleId ? t.recurringRuleId !== ruleId : t.id !== id))
            } else if (mode === 'future') {
              const ruleId = selectedEntry.entry.recurringRuleId
              const entryDate = new Date(selectedEntry.entry.date)
              setTimeline(prev => prev.filter(t =>
                t.recurringRuleId !== ruleId || new Date(t.date) < entryDate
              ))
            } else {
              setTimeline(prev => prev.filter(t => t.id !== id))
            }
          }}
        />
      )}

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
              {(['weekly', 'monthly'] as const).map((v, i) => (
                <button
                  key={v}
                  onClick={() => setView(v)}
                  className="px-2 py-1 text-xs transition-all"
                  style={{
                    background: view === v ? 'var(--accent-dim)' : 'var(--bg-card)',
                    color: view === v ? 'var(--accent-light)' : 'var(--text-muted)',
                    borderRight: i < 1 ? '1px solid var(--border)' : 'none',
                  }}
                >
                  {isMobile
                    ? (v === 'weekly' ? '주' : '월')
                    : (v === 'weekly' ? '주간' : '월간')}
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
        {view === 'weekly' && (
          <div className="flex flex-wrap items-center gap-1.5">
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
              onClick={() => {
                const weekStart = startOfWeek(new Date(), { weekStartsOn: 1 })
                setCurrentWeekStart(weekStart)
                setDesktopViewStart(weekStart)
              }}
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
            {view === 'weekly' && (
              <AIPanel
                weekStart={currentWeekStart}
                today={new Date()}
                modes={['weekly', 'daily']}
                defaultMode="weekly"
              />
            )}
            {view === 'weekly' && isMobile && (
              <div className="flex rounded-lg overflow-hidden" style={{ border: '1px solid var(--border)' }}>
                {[1, 2, 3].map((n, i, arr) => (
                  <button
                    key={n}
                    onClick={() => setMobileDayColsPersist(n)}
                    className="px-2 py-1 text-xs transition-all"
                    style={{
                      background: mobileDayCols === n ? 'var(--accent-dim)' : 'var(--bg-card)',
                      color: mobileDayCols === n ? 'var(--accent-light)' : 'var(--text-muted)',
                      borderRight: i < arr.length - 1 ? '1px solid var(--border)' : 'none',
                    }}
                  >
                    {n}일
                  </button>
                ))}
              </div>
            )}
            {view === 'weekly' && !isMobile && (
              <div className="flex rounded-lg overflow-hidden" style={{ border: '1px solid var(--border)' }}>
                {[3, 5, 7].map((n, i, arr) => (
                  <button
                    key={n}
                    onClick={() => setDesktopDayColsPersist(n)}
                    className="px-2 py-1 text-xs transition-all"
                    style={{
                      background: desktopDayCols === n ? 'var(--accent-dim)' : 'var(--bg-card)',
                      color: desktopDayCols === n ? 'var(--accent-light)' : 'var(--text-muted)',
                      borderRight: i < arr.length - 1 ? '1px solid var(--border)' : 'none',
                    }}
                  >
                    {n}일
                  </button>
                ))}
              </div>
            )}
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

      {view === 'monthly' && (
        <div
          key={format(currentMonth, 'yyyy-MM')}
          className={monthSlideDir === 'next' ? 'week-slide-next' : monthSlideDir === 'prev' ? 'week-slide-prev' : ''}
          onAnimationEnd={() => setMonthSlideDir(null)}
          style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}
        >
          <MonthlyCalendar
            currentMonth={currentMonth}
            monthCount={monthCount}
            enabledCalendars={monthlyEnabledCals}
            calendarList={calendarList}
            onDateSelect={(date) => {
              const day = date.getDay()
              const dayIndex = day === 0 ? 6 : day - 1
              setCurrentWeekStart(startOfWeek(date, { weekStartsOn: 1 }))
              if (isMobile) setMobileDay(dayIndex)
              setView('weekly')
            }}
          />
        </div>
      )}

      {/* 모바일 날짜 탭 */}
      {view === 'weekly' && isMobile && (
        <div className="flex gap-1 mb-3 flex-shrink-0">
          {weekDays.map((day, i) => {
            const today = isToday(day)
            const isSelected = i >= mobileStart && i < mobileStart + mobileDayCols
            return (
              <button
                key={i}
                onClick={() => setMobileDay(i)}
                className="flex flex-col items-center gap-0.5 px-1 py-2 rounded-xl flex-1 transition-all"
                style={{
                  background: isSelected ? 'var(--accent-dim)' : today ? 'rgba(139,92,246,0.06)' : 'var(--bg-card)',
                  border: `1px solid ${isSelected ? 'var(--accent)' : today ? 'rgba(139,92,246,0.3)' : 'var(--border)'}`,
                  minWidth: 0,
                }}
              >
                <span
                  className="text-[10px] font-semibold"
                  style={{ color: isSelected ? 'var(--accent-light)' : today ? 'var(--accent)' : 'var(--text-dim)' }}
                >
                  {DAYS_KO[i]}
                </span>
                <span
                  className="text-base font-bold leading-none"
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
          <div className="flex flex-col gap-2">
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
                  if (e.key === 'Escape') { setAddingTodoDay(null); setNewTodoTitle(''); setTodoRepeat(false) }
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
                type="button"
                onClick={() => setTodoRepeat(r => !r)}
                className="p-2 rounded-xl flex-shrink-0 text-xs"
                style={{
                  background: todoRepeat ? 'var(--accent-dim)' : 'var(--bg-card)',
                  color: todoRepeat ? 'var(--accent-light)' : 'var(--text-dim)',
                  border: `1px solid ${todoRepeat ? 'var(--accent)' : 'var(--border)'}`,
                }}
              >
                반복
              </button>
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
                onClick={() => { setAddingTodoDay(null); setNewTodoTitle(''); setTodoRepeat(false) }}
                className="p-2.5 rounded-xl flex-shrink-0"
                style={{ background: 'var(--bg-card)', color: 'var(--text-dim)', border: '1px solid var(--border)' }}
              >
                <X size={16} />
              </button>
            </div>
            {todoRepeat && (
              <RepeatPicker
                freq={todoFreq}
                weekDays={todoWeekDays}
                onFreqChange={setTodoFreq}
                onWeekDayToggle={iso => setTodoWeekDays(prev => prev.includes(iso) ? prev.filter(d => d !== iso) : [...prev, iso])}
              />
            )}
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
        ref={outerScrollRef}
        key={(!isMobile && desktopDayCols < 7 ? desktopViewStart : currentWeekStart).toISOString()}
        className={`flex-1 flex flex-col rounded-xl${slideDir === 'next' ? ' week-slide-next' : slideDir === 'prev' ? ' week-slide-prev' : ''}`}
        style={{ minWidth: 0, border: '1px solid var(--border)', overflowX: 'auto', overflowY: 'auto' }}
        onAnimationEnd={() => setSlideDir(null)}
      >
        {/* ── 상단 고정: 헤더 + 하이라이트 + TO-DO ── */}
        <div ref={topSectionRef} style={{ flexShrink: 0, position: 'sticky', top: 0 }}>
        <div style={{
          display: 'grid',
          gridTemplateColumns: gridCols,
          minWidth: gridMinWidth,
        }}>

          {/* ── Day headers ── */}
          <div
            style={{ background: 'var(--bg-surface)', borderBottom: '1px solid var(--border)' }}
          />
          {visibleDays.map((day) => {
            const wi = dayOfWeekIdx(day)
            const today = isToday(day)
            const dayKey = format(day, 'yyyy-MM-dd')
            const hasHighlight = highlights.some(x => x.date === dayKey)
            return (
              <div
                key={dayKey}
                className="px-2 py-2"
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
                  <div className="flex items-start justify-between gap-0.5">
                    <div>
                      <div className="text-[11px] font-semibold tracking-wide" style={{ color: today ? 'var(--accent)' : wi >= 5 ? 'var(--text-muted)' : 'var(--text-dim)' }}>{DAYS_KO[wi]}</div>
                      <div className="text-xl font-bold leading-tight" style={{ color: today ? 'var(--accent-light)' : 'var(--text-bright)' }}>{format(day, 'd')}</div>
                      <div className="text-[9px]" style={{ color: 'var(--text-dim)' }}>{format(day, 'MM/dd')}</div>
                    </div>
                    <button
                      onClick={() => setHighlightOpenDay(d => d === dayKey ? null : dayKey)}
                      className="text-sm leading-none px-1 py-0.5 rounded transition-all flex-shrink-0"
                      style={{
                        color: hasHighlight || highlightOpenDay === dayKey ? '#ca8a04' : 'rgba(202,138,4,0.25)',
                        background: highlightOpenDay === dayKey ? 'rgba(234,179,8,0.1)' : 'transparent',
                      }}
                    >★</button>
                  </div>
                )}
              </div>
            )
          })}

          {/* ── Highlight section ── */}
          <div />{/* 레이블 열 자리 채우기 — grid row 정렬을 위해 항상 출력 */}
          {visibleDays.map((day) => {
            const dayKey = format(day, 'yyyy-MM-dd')
            const h = highlights.find(x => x.date === dayKey)
            const today = isToday(day)
            const isOpen = highlightOpenDay === dayKey
            if (!h && !isOpen) return <div key={`hl-${dayKey}`} />
            return (
              <div key={`hl-${dayKey}`}>
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
            <span className="text-[9px] font-semibold leading-tight text-center" style={{ color: 'var(--text-dim)' }}>TO<br/>DO</span>
          </div>
          {visibleDays.map((day) => {
            const wi = dayOfWeekIdx(day)
            const dayKey = format(day, 'yyyy-MM-dd')
            const dayTodos = todosForDay(day)
            const isAdding = addingTodoDay === dayKey
            const today = isToday(day)
            return (
              <div
                key={dayKey}
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
                  <div className="space-y-0" onClick={() => { setActiveTodoId(null); setEditingTodoId(null) }}>
                    {(() => {
                      const MAX = 6
                      const expanded = expandedTodoDays.has(dayKey)
                      const displayTodos = expanded ? dayTodos : dayTodos.slice(0, MAX)
                      const hiddenCount = dayTodos.length - MAX
                      return <>
                        {displayTodos.map(todo => {
                      const isActive = activeTodoId === todo.id
                      return (
                        <div
                          key={todo.id}
                          data-todo-row
                          className="flex flex-col px-1 py-1 rounded transition-colors"
                          style={{ background: isActive ? 'var(--bg-hover)' : 'transparent' }}
                          onClick={e => e.stopPropagation()}
                        >
                          {/* Row 1: checkbox + text */}
                          <div className="flex items-start gap-1">
                            {/* 체크박스 — urgent 시 빨간 배경 */}
                            <button
                              onClick={() => toggleTodo(todo.id, todo.completed)}
                              className="w-3.5 h-3.5 rounded flex-shrink-0 flex items-center justify-center transition-all mt-px"
                              style={{
                                background: todo.completed ? 'var(--accent-dim)' : todo.urgent ? 'rgba(239,68,68,0.18)' : 'transparent',
                                border: `1.5px solid ${todo.completed ? 'var(--accent)' : todo.urgent ? '#ef4444' : 'var(--border)'}`,
                                cursor: 'pointer',
                              }}
                            >
                              {todo.completed && <Check size={10} style={{ color: 'var(--accent-light)' }} />}
                            </button>
                            {editingTodoId === todo.id ? (
                              <input
                                autoFocus
                                value={editingTodoTitle}
                                onChange={e => setEditingTodoTitle(e.target.value)}
                                onKeyDown={e => {
                                  e.stopPropagation()
                                  if (e.key === 'Enter' && !e.nativeEvent.isComposing) commitEditTodo(todo)
                                  if (e.key === 'Escape') setEditingTodoId(null)
                                }}
                                onBlur={() => commitEditTodo(todo)}
                                onClick={e => e.stopPropagation()}
                                className="text-[12px] flex-1 min-w-0 focus:outline-none"
                                style={{ background: 'transparent', borderBottom: '1px solid var(--accent)', color: 'var(--text)' }}
                              />
                            ) : (
                              <span
                                className="text-[12px] leading-snug flex-1 min-w-0 break-words cursor-pointer"
                                style={{ color: todo.completed ? 'var(--text-dim)' : 'var(--text)', textDecoration: todo.completed ? 'line-through' : 'none' }}
                                onClick={e => { e.stopPropagation(); startEditTodo(todo); setActiveTodoId(todo.id) }}
                              >
                                {todo.recurringRuleId && (
                                  <span style={{ fontSize: 9, opacity: 0.55, marginRight: 2 }} className={isActive ? 'inline' : 'hidden'}>🔁</span>
                                )}
                                {todo.title}
                              </span>
                            )}
                          </div>
                          {/* Row 2: 액션 버튼 (클릭 활성 시) */}
                          {isActive && (
                            <div className="flex items-center gap-1 pl-4 pt-0.5 flex-wrap">
                              <button
                                onClick={e => { e.stopPropagation(); toggleUrgent(todo.id, todo.urgent) }}
                                className="text-[10px] px-1.5 py-0.5 rounded flex items-center gap-0.5"
                                style={{
                                  color: todo.urgent ? '#ef4444' : 'var(--text-dim)',
                                  background: todo.urgent ? 'rgba(239,68,68,0.1)' : 'var(--bg-input)',
                                  border: `1px solid ${todo.urgent ? 'rgba(239,68,68,0.3)' : 'var(--border)'}`,
                                }}
                              >
                                <AlertCircle size={9} />{todo.urgent ? '긴급해제' : '긴급'}
                              </button>
                              {todo.date && (
                                <button
                                  onClick={e => {
                                    e.stopPropagation()
                                    const nextDay = addDays(new Date(todo.date!), 1)
                                    const nextDateStr = format(nextDay, 'yyyy-MM-dd')
                                    setTodos(prev => prev.map(t => t.id === todo.id ? { ...t, date: nextDay.toISOString() } : t))
                                    setActiveTodoId(null)
                                    fetch(`/api/todos/${todo.id}`, {
                                      method: 'PATCH',
                                      headers: { 'Content-Type': 'application/json' },
                                      body: JSON.stringify({ date: nextDateStr }),
                                    }).catch(() => fetchData())
                                  }}
                                  className="text-[10px] px-1.5 py-0.5 rounded flex items-center gap-0.5"
                                  style={{ color: 'var(--text-dim)', background: 'var(--bg-input)', border: '1px solid var(--border)' }}
                                >
                                  다음날↗
                                </button>
                              )}
                              <button
                                onClick={e => { e.stopPropagation(); deleteTodo(todo.id); setActiveTodoId(null) }}
                                className="text-[10px] px-1.5 py-0.5 rounded flex items-center gap-0.5"
                                style={{ color: '#ef4444', background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.25)' }}
                              >
                                <X size={9} />삭제
                              </button>
                            </div>
                          )}
                        </div>
                      )
                    })}
                        {!expanded && hiddenCount > 0 && (
                          <button
                            onClick={e => { e.stopPropagation(); setExpandedTodoDays(prev => new Set(prev).add(dayKey)) }}
                            className="text-[10px] px-1.5 py-1 rounded w-full text-center transition-colors"
                            style={{ color: 'var(--text-dim)', background: 'var(--bg-hover)', border: '1px dashed var(--border)', cursor: 'pointer' }}
                          >
                            더보기 (+{hiddenCount})
                          </button>
                        )}
                        {expanded && hiddenCount > 0 && (
                          <button
                            onClick={e => { e.stopPropagation(); setExpandedTodoDays(prev => { const n = new Set(prev); n.delete(dayKey); return n }) }}
                            className="text-[10px] px-1.5 py-0.5 rounded w-full text-center transition-colors"
                            style={{ color: 'var(--text-dim)', cursor: 'pointer' }}
                          >
                            접기
                          </button>
                        )}
                      </>
                    })()}
                    {isAdding && !isMobile ? (
                      <div className="flex flex-col gap-1 px-1">
                        <div className="flex items-center gap-1.5">
                          <input
                            type="text"
                            value={newTodoTitle}
                            onChange={e => setNewTodoTitle(e.target.value)}
                            onKeyDown={e => {
                              if (e.key === 'Enter') submitTodo(day)
                              if (e.key === 'Escape') { setAddingTodoDay(null); setNewTodoTitle(''); setTodoRepeat(false) }
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
                            type="button"
                            onClick={() => setTodoRepeat(r => !r)}
                            className="text-[10px] px-1.5 py-0.5 rounded flex-shrink-0"
                            style={{
                              background: todoRepeat ? 'var(--accent-dim)' : 'transparent',
                              color: todoRepeat ? 'var(--accent-light)' : 'var(--text-dim)',
                              border: `1px solid ${todoRepeat ? 'var(--accent)' : 'var(--border)'}`,
                            }}
                          >
                            반복
                          </button>
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
                            onClick={() => { setAddingTodoDay(null); setNewTodoTitle(''); setTodoRepeat(false) }}
                            className="p-1 rounded transition-all"
                            style={{ color: 'var(--text-dim)', cursor: 'pointer' }}
                            onMouseEnter={e => { e.currentTarget.style.background = 'var(--bg-card)'; e.currentTarget.style.color = 'var(--text)' }}
                            onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--text-dim)' }}
                          >
                            <X size={13} />
                          </button>
                        </div>
                        {todoRepeat && (
                          <RepeatPicker
                            freq={todoFreq}
                            weekDays={todoWeekDays}
                            onFreqChange={setTodoFreq}
                            onWeekDayToggle={iso => setTodoWeekDays(prev => prev.includes(iso) ? prev.filter(d => d !== iso) : [...prev, iso])}
                          />
                        )}
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

        </div>{/* grid 끝 (상단: 헤더+하이라이트+TODO) */}
        </div>{/* 상단 고정 컨테이너 끝 */}

        {/* ── 하단 독립 스크롤: 타임라인 ── */}
        <div
          ref={gridScrollRef}
          style={{ flex: 1, overflowX: 'clip', overscrollBehavior: 'contain' }}
        >
        <div style={{
          display: 'grid',
          gridTemplateColumns: gridCols,
          minWidth: gridMinWidth,
          minHeight: timelineHeight,
        }}>

          {/* ── Timeline separator ── */}
          <div
            style={{ gridColumn: '1 / -1', borderBottom: '1px solid var(--border-dim)', background: 'var(--bg-surface)', position: 'sticky', top: topSectionHeight, zIndex: 5 }}
            className="flex items-center gap-2 px-3 py-1"
          >
            <div className="w-1 h-1 rounded-full" style={{ background: 'var(--accent-dim)' }} />
            <span className="text-[9px] tracking-[0.2em] font-semibold uppercase" style={{ color: 'var(--text-dim)' }}>
              Timeline
            </span>
          </div>

          {/* ── Timeline date headers ── */}
          <div style={{ background: 'var(--bg-surface)', borderRight: '1px solid var(--border)', borderBottom: '1px solid var(--border-dim)', position: 'sticky', top: topSectionHeight + 24, zIndex: 4 }} />
          {visibleDays.map(day => {
            const dKey = format(day, 'yyyy-MM-dd')
            const td = isToday(day)
            const dwi = dayOfWeekIdx(day)
            return (
              <div
                key={`tl-hdr-${dKey}`}
                className="flex items-center justify-center gap-1 py-1"
                style={{
                  background: td ? 'rgba(139, 92, 246, 0.08)' : 'var(--bg-surface)',
                  borderLeft: '1px solid var(--border)',
                  borderBottom: '1px solid var(--border-dim)',
                  position: 'sticky', top: topSectionHeight + 24, zIndex: 4,
                }}
              >
                <span className="text-[10px] font-semibold" style={{ color: td ? 'var(--accent)' : dwi >= 5 ? 'var(--text-muted)' : 'var(--text-dim)' }}>
                  {DAYS_KO[dwi]}
                </span>
                <span className="text-[10px] font-medium" style={{ color: td ? 'var(--accent-light)' : 'var(--text-dim)' }}>
                  {format(day, 'd')}
                </span>
              </div>
            )
          })}

          {/* ── All-day events row ── */}
          {visibleDays.some(day => allDayGoogleEventsForDay(day).length > 0) && (
            <>
              <div
                style={{ background: 'var(--bg-surface)', borderRight: '1px solid var(--border)', borderBottom: '1px solid var(--border-rule)', minHeight: 28 }}
                className="flex items-center gap-2 px-3 whitespace-nowrap"
              >
                <div className="w-1 h-1 rounded-full flex-shrink-0" style={{ background: 'var(--accent-dim)' }} />
                <span className="text-[9px] tracking-[0.2em] font-semibold uppercase" style={{ color: 'var(--text-dim)' }}>종일</span>
              </div>
              {visibleDays.map(day => {
                const events = allDayGoogleEventsForDay(day)
                return (
                  <div
                    key={format(day, 'yyyy-MM-dd') + '-allday'}
                    style={{ background: 'var(--bg-surface)', borderBottom: '1px solid var(--border-rule)', borderRight: '1px solid var(--border)', minHeight: 28, padding: '3px 4px' }}
                    className="flex flex-col gap-0.5"
                  >
                    {events.map(e => (
                      <div
                        key={e.id}
                        className="text-[9px] rounded px-1 py-0.5 truncate leading-tight"
                        style={{ background: e.calendarColor + '33', color: e.calendarColor, border: '1px solid ' + e.calendarColor + '66' }}
                        title={e.summary}
                      >
                        {e.summary ?? '(제목 없음)'}
                      </div>
                    ))}
                  </div>
                )
              })}
            </>
          )}

          {/* ── Time labels ── */}
          <div style={{ position: 'relative', height: timelineHeight, background: 'var(--bg-surface)', borderRight: '1px solid var(--border)' }}>
            {HOURS.map(hour => (
              <div
                key={hour}
                style={{ position: 'absolute', top: (hour - FIRST_HOUR) * ROW_H + 3, right: 3, color: 'var(--text-dim)' }}
                className="text-[10px] font-mono tabular-nums leading-none"
              >
                {String(hour).padStart(2, '0')}
              </div>
            ))}
          </div>

          {/* ── Day columns ── */}
          {visibleDays.map((day, colIdx) => {
            const dateKey = format(day, 'yyyy-MM-dd')
            const dayEntries = entriesForDay(day)
            const dayGoogleEvents = googleEventsForDay(day)
            const today = isToday(day)
            const isAddingHere = addingEntry?.dateKey === dateKey

            // 겹치는 항목 레이아웃 계산 (로컬 + 구글 통합)
            const layoutItems = [
              ...dayEntries.map(e => ({ id: e.id, start: e.startTime, end: e.endTime || addOneHour(e.startTime) })),
              ...dayGoogleEvents.map(e => { const c = clipTimedEvent(e, day); return { id: `g_${e.id}`, start: c.startTime, end: c.endTime } }),
            ]
            const layout = computeOverlapLayout(layoutItems)

            return (
              <div
                key={dateKey}
                ref={el => { columnRefs.current[colIdx] = el }}
                style={{
                  position: 'relative', height: timelineHeight,
                  background: today ? 'rgba(139, 92, 246, 0.04)' : 'var(--bg-surface)',
                  borderLeft: '1px solid var(--border)',
                }}
                className="paper-lines"
                onMouseDown={e => {
                  if (e.button !== 0 || isAddingHere || didDragRef.current) return
                  const rect = e.currentTarget.getBoundingClientRect()
                  const startY = e.clientY - rect.top
                  creationDragRef.current = { dateKey, day, startY, startMouseY: e.clientY, columnTop: rect.top }

                  const onMove = (ev: MouseEvent) => {
                    const drag = creationDragRef.current
                    if (!drag || drag.dateKey !== dateKey) return
                    const currentY = Math.max(0, Math.min(timelineHeight, ev.clientY - drag.columnTop))
                    if (Math.abs(ev.clientY - drag.startMouseY) > 5) {
                      setCreationDrag({
                        dateKey: drag.dateKey,
                        topY: Math.min(drag.startY, currentY),
                        bottomY: Math.max(drag.startY, currentY),
                      })
                    }
                  }

                  const onUp = (ev: MouseEvent) => {
                    document.removeEventListener('mousemove', onMove)
                    document.removeEventListener('mouseup', onUp)
                    document.body.style.userSelect = ''
                    const drag = creationDragRef.current
                    creationDragRef.current = null
                    setCreationDrag(null)
                    if (!drag || didDragRef.current) return
                    const currentY = Math.max(0, Math.min(timelineHeight, ev.clientY - drag.columnTop))
                    const delta = Math.abs(ev.clientY - drag.startMouseY)
                    if (delta < 8) {
                      // 클릭 — 기존 동작
                      const hour = Math.min(LAST_HOUR, FIRST_HOUR + Math.floor(drag.startY / ROW_H))
                      setAddingEntry({ dateKey: drag.dateKey, hour })
                      setNewEntry({ title: '', endTime: '', category: '' })
                    } else {
                      // 드래그 — 시간 범위 선택
                      const topY = Math.min(drag.startY, currentY)
                      const bottomY = Math.max(drag.startY + ROW_H / 4, currentY)
                      const startTime = yToTime(topY)
                      const endTime = yToTime(bottomY)
                      const hour = FIRST_HOUR + Math.floor(topY / ROW_H)
                      setAddingEntry({ dateKey: drag.dateKey, hour, startTime })
                      setNewEntry({ title: '', endTime, category: '' })
                    }
                  }

                  document.body.style.userSelect = 'none'
                  document.addEventListener('mousemove', onMove)
                  document.addEventListener('mouseup', onUp)
                }}
              >
                {/* Current time indicator */}
                {today && nowY !== null && (
                  <div
                    style={{ position: 'absolute', top: nowY, left: 0, right: 0, zIndex: 31 }}
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
                  const { startTime, endTime } = clipTimedEvent(event, day)
                  return <GoogleEventBlock key={event.id} event={event} layoutCol={lv?.col} layoutTotal={lv?.total} effectiveStart={startTime} effectiveEnd={endTime} />
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
                      onSelect={(e, rect) => setSelectedEntry({ entry: e, rect })}
                      layoutCol={lv?.col}
                      layoutTotal={lv?.total}
                    />
                  )
                })}

                {/* Creation drag preview */}
                {creationDrag?.dateKey === dateKey && (
                  <div
                    className="pointer-events-none"
                    style={{
                      position: 'absolute',
                      top: creationDrag.topY,
                      height: Math.max(ROW_H / 4, creationDrag.bottomY - creationDrag.topY),
                      left: 3, right: 3, zIndex: 25,
                      background: 'var(--accent-dim)',
                      border: '1px solid var(--accent)',
                      borderRadius: 6,
                      opacity: 0.7,
                    }}
                  >
                    <span className="text-[10px] px-1.5 pt-0.5 block" style={{ color: 'var(--accent-light)' }}>
                      {yToTime(creationDrag.topY)} ~ {yToTime(creationDrag.bottomY)}
                    </span>
                  </div>
                )}

                {/* Draft entry block + floating tooltip */}
                {isAddingHere && (() => {
                  const formStartTime = addingEntry!.startTime ?? `${String(addingEntry!.hour).padStart(2, '0')}:00`
                  const formTopY = Math.max(0, timeToY(formStartTime))
                  const formEndTime = newEntry.endTime || addOneHour(formStartTime)
                  const formHeight = Math.max(ROW_H / 2, timeToY(formEndTime) - formTopY)

                  // tooltip position (fixed) — read column rect at render time
                  const colRect = columnRefs.current[colIdx]?.getBoundingClientRect()
                  const tipW = 192
                  const rawTipTop = colRect ? colRect.top + formTopY : formTopY
                  const tipTop = Math.max(8, Math.min(rawTipTop, window.innerHeight - 300))
                  const flipLeft = colRect ? colRect.right + 4 + tipW > window.innerWidth : colIdx >= 5
                  const rawTipLeft = colRect
                    ? flipLeft ? colRect.left - tipW - 4 : colRect.right + 4
                    : 0
                  const tipLeft = Math.max(8, Math.min(rawTipLeft, window.innerWidth - tipW - 8))

                  return (
                  <>
                    {/* 드래프트 블록 — 이동 + 리사이즈 */}
                    <div
                      style={{
                        position: 'absolute',
                        top: formTopY, height: formHeight,
                        left: 3, right: 3, zIndex: 30,
                        background: 'var(--accent-dim)',
                        border: '1px solid var(--accent)',
                        borderRadius: 6,
                        cursor: 'grab',
                      }}
                      className="select-none group"
                      onMouseDown={e => {
                        e.stopPropagation()
                        e.preventDefault()
                        const duration = timeToY(formEndTime) - timeToY(formStartTime)
                        const startMouseY = e.clientY
                        const startTopY = formTopY
                        const onMove = (ev: MouseEvent) => {
                          const delta = ev.clientY - startMouseY
                          const newTopY = Math.max(0, startTopY + delta)
                          setAddingEntry(prev => prev ? { ...prev, startTime: yToTime(newTopY) } : prev)
                          setNewEntry(prev => ({ ...prev, endTime: yToTime(newTopY + duration) }))
                        }
                        const onUp = () => {
                          document.removeEventListener('mousemove', onMove)
                          document.removeEventListener('mouseup', onUp)
                          document.body.style.cursor = ''
                          document.body.style.userSelect = ''
                        }
                        document.body.style.cursor = 'grabbing'
                        document.body.style.userSelect = 'none'
                        document.addEventListener('mousemove', onMove)
                        document.addEventListener('mouseup', onUp)
                      }}
                    >
                      <div className="px-1.5 pt-1 pointer-events-none">
                        <div className="font-mono text-[9px] opacity-70" style={{ color: 'var(--accent-light)' }}>
                          {formStartTime} – {formEndTime}
                        </div>
                        {newEntry.title && (
                          <div className="text-[10px] font-medium truncate mt-0.5" style={{ color: 'var(--accent-light)' }}>
                            {newEntry.title}
                          </div>
                        )}
                      </div>
                      {/* 리사이즈 핸들 */}
                      <div
                        style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 10, cursor: 'ns-resize', zIndex: 31 }}
                        className="flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                        onMouseDown={e => {
                          e.preventDefault()
                          e.stopPropagation()
                          const startEndY = timeToY(formEndTime)
                          const minY = timeToY(formStartTime) + ROW_H / 4
                          const startMouseY = e.clientY
                          const onMove = (ev: MouseEvent) => {
                            const newEndY = Math.max(minY, startEndY + (ev.clientY - startMouseY))
                            setNewEntry(p => ({ ...p, endTime: yToTime(newEndY) }))
                          }
                          const onUp = () => {
                            document.removeEventListener('mousemove', onMove)
                            document.removeEventListener('mouseup', onUp)
                            document.body.style.cursor = ''
                            document.body.style.userSelect = ''
                          }
                          document.body.style.cursor = 'ns-resize'
                          document.body.style.userSelect = 'none'
                          document.addEventListener('mousemove', onMove)
                          document.addEventListener('mouseup', onUp)
                        }}
                      >
                        <div className="w-8 h-[2px] rounded-full" style={{ background: 'var(--accent)' }} />
                      </div>
                    </div>

                    {/* 플로팅 툴팁 — fixed 포지셔닝 */}
                    <div
                      style={{
                        position: 'fixed',
                        top: tipTop,
                        left: tipLeft,
                        width: tipW,
                        zIndex: 9999,
                        background: 'var(--bg-card)',
                        border: '1px solid var(--border)',
                        borderRadius: 10,
                        boxShadow: '0 6px 24px rgba(0,0,0,0.35)',
                      }}
                      className="p-2"
                      onMouseDown={e => e.stopPropagation()}
                      onClick={e => e.stopPropagation()}
                    >
                      <input
                        type="text"
                        value={newEntry.title}
                        onChange={e => setNewEntry(p => ({ ...p, title: e.target.value }))}
                        onKeyDown={e => {
                          if (e.nativeEvent.isComposing) return
                          if (e.key === 'Enter') submitEntry(day, addingEntry!.hour, addingEntry!.startTime)
                          if (e.key === 'Escape') { setAddingEntry(null); setEntryRepeat(false); setEntryCreateTodo(false); setEntryHideMonthly(false) }
                        }}
                        placeholder="내용..."
                        className="w-full bg-transparent border-none text-[11px] focus:outline-none mb-1.5"
                        style={{ color: 'var(--text)' }}
                        autoFocus
                      />
                      <div className="flex gap-1 flex-wrap">
                        <select
                          value={newEntry.category}
                          onChange={e => setNewEntry(p => ({ ...p, category: e.target.value }))}
                          className="flex-1 text-[10px] rounded px-1 py-0.5 focus:outline-none"
                          style={{ background: 'var(--bg-input)', border: '1px solid var(--border)', color: 'var(--text-muted)', minWidth: 60 }}
                        >
                          <option value="">카테고리</option>
                          <option value="work">업무</option>
                          <option value="personal">개인</option>
                          <option value="exercise">운동</option>
                          <option value="study">학습</option>
                        </select>
                        <button
                          type="button"
                          onClick={e => { e.stopPropagation(); setEntryRepeat(r => !r) }}
                          className="text-[10px] px-1.5 py-0.5 rounded flex-shrink-0"
                          style={{
                            background: entryRepeat ? 'var(--accent-dim)' : 'transparent',
                            color: entryRepeat ? 'var(--accent-light)' : 'var(--text-dim)',
                            border: `1px solid ${entryRepeat ? 'var(--accent)' : 'var(--border)'}`,
                          }}
                        >
                          반복
                        </button>
                        <button
                          type="button"
                          onClick={e => { e.stopPropagation(); setEntryCreateTodo(r => !r) }}
                          className="text-[10px] px-1.5 py-0.5 rounded flex-shrink-0"
                          style={{
                            background: entryCreateTodo ? 'var(--accent-dim)' : 'transparent',
                            color: entryCreateTodo ? 'var(--accent-light)' : 'var(--text-dim)',
                            border: `1px solid ${entryCreateTodo ? 'var(--accent)' : 'var(--border)'}`,
                          }}
                        >
                          TODO
                        </button>
                        <button
                          type="button"
                          onClick={e => { e.stopPropagation(); setEntryHideMonthly(r => !r) }}
                          className="text-[10px] px-1.5 py-0.5 rounded flex-shrink-0"
                          style={{
                            background: entryHideMonthly ? 'var(--accent-dim)' : 'transparent',
                            color: entryHideMonthly ? 'var(--accent-light)' : 'var(--text-dim)',
                            border: `1px solid ${entryHideMonthly ? 'var(--accent)' : 'var(--border)'}`,
                          }}
                        >
                          월숨김
                        </button>
                        <button onClick={() => submitEntry(day, addingEntry!.hour, addingEntry!.startTime)} style={{ color: 'var(--accent)' }}>
                          <Check size={12} />
                        </button>
                        <button onClick={() => { setAddingEntry(null); setEntryRepeat(false); setEntryCreateTodo(false); setEntryHideMonthly(false) }} style={{ color: 'var(--text-dim)' }}>
                          <X size={12} />
                        </button>
                      </div>
                      {entryRepeat && (
                        <div className="pt-1">
                          <RepeatPicker
                            freq={entryFreq}
                            weekDays={entryWeekDays}
                            onFreqChange={setEntryFreq}
                            onWeekDayToggle={iso => setEntryWeekDays(prev => prev.includes(iso) ? prev.filter(d => d !== iso) : [...prev, iso])}
                          />
                        </div>
                      )}
                    </div>
                  </>
                  )
                })()}
              </div>
            )
          })}
        </div>{/* grid 끝 (타임라인) */}
        </div>{/* 하단 타임라인 스크롤 컨테이너 끝 */}
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
      ) : null}
    </div>
  )
}

