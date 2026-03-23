export {}

/**
 * 월간 캘린더 타임라인 필터 로직 테스트
 *
 * MonthlyCalendar.tsx의 timelineForDay 필터 동작 검증:
 *   - hideFromMonthly: true 항목은 표시하지 않음
 *   - hideFromMonthly: false 항목은 날짜가 일치하면 표시
 *   - 날짜 불일치 항목은 제외
 */

// ── 타입 ──────────────────────────────────────────────────────────────────────

interface TimelineEntry {
  id: string
  title: string
  date: string // 'yyyy-MM-dd'
  startTime: string
  category: string | null
  hideFromMonthly: boolean
}

// ── 순수 필터 함수 (MonthlyCalendar.tsx 동일 로직) ───────────────────────────

function isSameDate(a: Date, b: Date): boolean {
  return (
    a.getUTCFullYear() === b.getUTCFullYear() &&
    a.getUTCMonth() === b.getUTCMonth() &&
    a.getUTCDate() === b.getUTCDate()
  )
}

function timelineForDay(entries: TimelineEntry[], day: Date): TimelineEntry[] {
  return entries.filter(e => !e.hideFromMonthly && isSameDate(new Date(e.date), day))
}

// ── 픽스처 ────────────────────────────────────────────────────────────────────

const TARGET_DATE = new Date('2026-03-23T00:00:00.000Z') // 월요일

function makeEntries(): TimelineEntry[] {
  return [
    { id: 'v1', title: '영어 화상 통화',  date: '2026-03-23', startTime: '22:00', category: 'study',    hideFromMonthly: false },
    { id: 'v2', title: '매일 루틴',       date: '2026-03-23', startTime: '07:00', category: 'exercise', hideFromMonthly: true  },
    { id: 'v3', title: '팀 미팅',         date: '2026-03-23', startTime: '10:00', category: 'work',     hideFromMonthly: false },
    { id: 'v4', title: '다른 날 항목',    date: '2026-03-24', startTime: '09:00', category: null,       hideFromMonthly: false },
    { id: 'v5', title: '숨김+다른 날',    date: '2026-03-24', startTime: '08:00', category: null,       hideFromMonthly: true  },
  ]
}

// ── hideFromMonthly 필터 ──────────────────────────────────────────────────────

describe('timelineForDay - hideFromMonthly 필터', () => {
  test('hideFromMonthly: true 항목은 결과에서 제외', () => {
    const result = timelineForDay(makeEntries(), TARGET_DATE)
    expect(result.find(e => e.id === 'v2')).toBeUndefined()
  })

  test('hideFromMonthly: false 항목은 날짜 일치 시 포함', () => {
    const result = timelineForDay(makeEntries(), TARGET_DATE)
    expect(result.find(e => e.id === 'v1')).toBeDefined()
    expect(result.find(e => e.id === 'v3')).toBeDefined()
  })

  test('같은 날짜라도 숨김 항목은 제외, 비숨김만 반환', () => {
    const result = timelineForDay(makeEntries(), TARGET_DATE)
    expect(result).toHaveLength(2) // v1, v3
    expect(result.map(e => e.id)).toEqual(['v1', 'v3'])
  })

  test('모든 항목이 숨김이면 빈 배열 반환', () => {
    const allHidden: TimelineEntry[] = [
      { id: 'h1', title: '매일 운동', date: '2026-03-23', startTime: '06:00', category: 'exercise', hideFromMonthly: true },
      { id: 'h2', title: '매일 독서', date: '2026-03-23', startTime: '23:00', category: 'study',    hideFromMonthly: true },
    ]
    expect(timelineForDay(allHidden, TARGET_DATE)).toHaveLength(0)
  })

  test('모든 항목이 비숨김이면 해당 날짜 전체 반환', () => {
    const allVisible: TimelineEntry[] = [
      { id: 'a1', title: '미팅 A', date: '2026-03-23', startTime: '09:00', category: 'work', hideFromMonthly: false },
      { id: 'a2', title: '미팅 B', date: '2026-03-23', startTime: '14:00', category: 'work', hideFromMonthly: false },
      { id: 'a3', title: '미팅 C', date: '2026-03-23', startTime: '18:00', category: 'work', hideFromMonthly: false },
    ]
    expect(timelineForDay(allVisible, TARGET_DATE)).toHaveLength(3)
  })
})

// ── 날짜 필터 ─────────────────────────────────────────────────────────────────

describe('timelineForDay - 날짜 필터', () => {
  test('날짜가 다른 항목은 비숨김이어도 제외', () => {
    const result = timelineForDay(makeEntries(), TARGET_DATE)
    expect(result.find(e => e.id === 'v4')).toBeUndefined()
  })

  test('숨김 + 날짜 불일치 항목도 제외', () => {
    const result = timelineForDay(makeEntries(), TARGET_DATE)
    expect(result.find(e => e.id === 'v5')).toBeUndefined()
  })

  test('다른 날짜로 조회 시 해당 날짜의 비숨김 항목만 반환', () => {
    const tomorrow = new Date('2026-03-24T00:00:00.000Z')
    const result = timelineForDay(makeEntries(), tomorrow)
    expect(result).toHaveLength(1) // v4만 (v5는 숨김)
    expect(result[0].id).toBe('v4')
  })

  test('항목이 없는 날짜는 빈 배열', () => {
    const noMatch = new Date('2026-04-01T00:00:00.000Z')
    expect(timelineForDay(makeEntries(), noMatch)).toHaveLength(0)
  })

  test('빈 목록이면 항상 빈 배열', () => {
    expect(timelineForDay([], TARGET_DATE)).toHaveLength(0)
  })
})

// ── 반복 일정 시나리오 ────────────────────────────────────────────────────────

describe('timelineForDay - 반복 일정 시나리오', () => {
  /** 매일 반복 항목 7개 (숨김) + 비반복 항목 2개 (비숨김) */
  function makeMixedEntries(): TimelineEntry[] {
    const days = ['2026-03-23', '2026-03-24', '2026-03-25', '2026-03-26',
                  '2026-03-27', '2026-03-28', '2026-03-29']
    const daily = days.map((d, i) => ({
      id: `daily-${i}`,
      title: '아침 루틴',
      date: d,
      startTime: '07:00',
      category: 'exercise' as const,
      hideFromMonthly: true,
    }))
    return [
      ...daily,
      { id: 'single-1', title: '팀 OKR 회의', date: '2026-03-23', startTime: '10:00', category: 'work', hideFromMonthly: false },
      { id: 'single-2', title: '팀 OKR 회의', date: '2026-03-25', startTime: '10:00', category: 'work', hideFromMonthly: false },
    ]
  }

  test('매일 반복(숨김) + 단발 이벤트(비숨김) 혼합 시 단발만 표시', () => {
    const entries = makeMixedEntries()
    const result = timelineForDay(entries, TARGET_DATE)
    expect(result).toHaveLength(1)
    expect(result[0].id).toBe('single-1')
  })

  test('각 날짜별로 숨김 항목은 제외되고 비숨김 항목만 표시', () => {
    const entries = makeMixedEntries()
    const days = [
      new Date('2026-03-23T00:00:00.000Z'),
      new Date('2026-03-24T00:00:00.000Z'),
      new Date('2026-03-25T00:00:00.000Z'),
    ]
    const [mon, tue, wed] = days.map(d => timelineForDay(entries, d))
    expect(mon).toHaveLength(1)  // single-1
    expect(tue).toHaveLength(0)  // 단발 없음
    expect(wed).toHaveLength(1)  // single-2
  })

  test('7일치 반복(숨김) 항목이 월간 뷰에 나타나지 않음 (전체 날짜 합산)', () => {
    const entries = makeMixedEntries()
    const weekDays = Array.from({ length: 7 }, (_, i) => {
      const d = new Date('2026-03-23T00:00:00.000Z')
      d.setUTCDate(d.getUTCDate() + i)
      return d
    })
    const totalVisible = weekDays.reduce((sum, d) => sum + timelineForDay(entries, d).length, 0)
    // 비숨김: single-1(23일), single-2(25일) = 2개만
    expect(totalVisible).toBe(2)
  })
})
