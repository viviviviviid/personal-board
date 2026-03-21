import { generateDates, createRecurringTodos, createRecurringTimelineEntries, RECURRING_WINDOW_DAYS } from '@/lib/recurring'
import { getISODay } from 'date-fns'

// ── Prisma 모크 ───────────────────────────────────────────────────────────────

const mockCreateMany = jest.fn().mockResolvedValue({ count: 0 })
const mockPrisma = {
  todo: { createMany: mockCreateMany },
  timelineEntry: { createMany: mockCreateMany },
} as any

beforeEach(() => {
  mockCreateMany.mockClear()
})

// 기준일: 2026-03-23 (월요일, ISO 1)
const START = new Date('2026-03-23T00:00:00.000Z')

function daysRange(days: number): Date {
  const d = new Date(START)
  d.setDate(d.getDate() + days)
  return d
}

// ── 상수 ──────────────────────────────────────────────────────────────────────

describe('RECURRING_WINDOW_DAYS', () => {
  test('365일', () => {
    expect(RECURRING_WINDOW_DAYS).toBe(365)
  })
})

// ── daily ─────────────────────────────────────────────────────────────────────

describe('generateDates - daily', () => {
  test('7일 범위에서 7개 반환', () => {
    const end = daysRange(6)
    const dates = generateDates('daily', [], undefined, START, end)
    expect(dates).toHaveLength(7)
  })

  test('첫 번째 날짜가 startDate', () => {
    const end = daysRange(6)
    const dates = generateDates('daily', [], undefined, START, end)
    expect(dates[0].getDate()).toBe(START.getDate())
  })

  test('단일 날짜 범위(start === end)에서 1개 반환', () => {
    const dates = generateDates('daily', [], undefined, START, START)
    expect(dates).toHaveLength(1)
  })

  test('365일 범위에서 365개 반환', () => {
    const end = daysRange(364)
    const dates = generateDates('daily', [], undefined, START, end)
    expect(dates).toHaveLength(365)
  })
})

// ── weekdays ──────────────────────────────────────────────────────────────────

describe('generateDates - weekdays', () => {
  test('7일(월~일) 범위에서 5개만 반환', () => {
    const end = daysRange(6)
    const dates = generateDates('weekdays', [], undefined, START, end)
    expect(dates).toHaveLength(5)
  })

  test('반환된 날짜가 모두 평일(ISO 1-5)', () => {
    const end = daysRange(13) // 2주
    const dates = generateDates('weekdays', [], undefined, START, end)
    dates.forEach(d => {
      expect(getISODay(d)).toBeLessThanOrEqual(5)
    })
  })

  test('토요일 시작 시 첫 날은 제외', () => {
    const sat = new Date('2026-03-28T00:00:00.000Z') // 토요일
    const end = new Date('2026-03-29T00:00:00.000Z') // 일요일
    const dates = generateDates('weekdays', [], undefined, sat, end)
    expect(dates).toHaveLength(0)
  })
})

// ── weekly ────────────────────────────────────────────────────────────────────

describe('generateDates - weekly', () => {
  test('월요일(1)만 선택 시 4주에서 4개', () => {
    const end = daysRange(27)
    const dates = generateDates('weekly', [1], undefined, START, end)
    expect(dates).toHaveLength(4)
  })

  test('월(1)+수(3) 선택 시 1주에서 2개', () => {
    const end = daysRange(6)
    const dates = generateDates('weekly', [1, 3], undefined, START, end)
    expect(dates).toHaveLength(2)
  })

  test('반환된 날짜의 요일이 선택한 weekDays에만 해당', () => {
    const end = daysRange(13)
    const weekDays = [2, 4] // 화, 목
    const dates = generateDates('weekly', weekDays, undefined, START, end)
    dates.forEach(d => {
      expect(weekDays).toContain(getISODay(d))
    })
  })

  test('weekDays 빈 배열이면 0개', () => {
    const end = daysRange(6)
    const dates = generateDates('weekly', [], undefined, START, end)
    expect(dates).toHaveLength(0)
  })

  test('모든 요일(1-7) 선택 시 daily와 동일', () => {
    const end = daysRange(6)
    const allDays = [1, 2, 3, 4, 5, 6, 7]
    const weekly = generateDates('weekly', allDays, undefined, START, end)
    const daily = generateDates('daily', [], undefined, START, end)
    expect(weekly).toHaveLength(daily.length)
  })

  test('일요일(7) 포함 선택', () => {
    const end = daysRange(6)
    const dates = generateDates('weekly', [7], undefined, START, end)
    expect(dates).toHaveLength(1)
    expect(getISODay(dates[0])).toBe(7)
  })
})

// ── monthly ───────────────────────────────────────────────────────────────────

describe('generateDates - monthly', () => {
  test('3개월 범위에서 3개 반환 (23일)', () => {
    const end = daysRange(89) // ~3개월
    const dates = generateDates('monthly', [], 23, START, end)
    expect(dates).toHaveLength(3)
  })

  test('반환된 날짜의 getDate()가 모두 monthDay', () => {
    const end = daysRange(89)
    const dates = generateDates('monthly', [], 15, START, end)
    dates.forEach(d => {
      expect(d.getDate()).toBe(15)
    })
  })

  test('monthDay가 범위 내에 없으면 0개', () => {
    // startDate가 24일이고 endDate가 26일이면 15일은 포함되지 않음
    const start = new Date('2026-03-24T00:00:00.000Z')
    const end = new Date('2026-03-26T00:00:00.000Z')
    const dates = generateDates('monthly', [], 15, start, end)
    expect(dates).toHaveLength(0)
  })

  test('startDate와 같은 날이 monthDay면 포함', () => {
    // 2026-03-23 시작, monthDay=23
    const dates = generateDates('monthly', [], 23, START, START)
    expect(dates).toHaveLength(1)
  })
})

// ── 경계값 ────────────────────────────────────────────────────────────────────

describe('generateDates - 경계값', () => {
  test('endDate < startDate이면 빈 배열', () => {
    const end = daysRange(-1)
    const dates = generateDates('daily', [], undefined, START, end)
    expect(dates).toHaveLength(0)
  })

  test('반환된 Date 객체가 서로 독립적 (참조 공유 없음)', () => {
    const end = daysRange(1)
    const dates = generateDates('daily', [], undefined, START, end)
    dates[0].setFullYear(2000)
    expect(dates[1].getFullYear()).toBe(2026)
  })
})

// ── createRecurringTodos ──────────────────────────────────────────────────────

describe('createRecurringTodos', () => {
  const RULE_ID = 'rule-1'
  const USER_ID = 'user-1'

  test('dates 수만큼 createMany 호출', async () => {
    const dates = generateDates('daily', [], undefined, START, daysRange(6))
    await createRecurringTodos(mockPrisma, RULE_ID, dates, '물 마시기', USER_ID)
    expect(mockCreateMany).toHaveBeenCalledTimes(1)
    const { data } = mockCreateMany.mock.calls[0][0]
    expect(data).toHaveLength(7)
  })

  test('각 row에 ruleId, userId, title, completed=false, priority=medium 포함', async () => {
    const dates = generateDates('daily', [], undefined, START, START)
    await createRecurringTodos(mockPrisma, RULE_ID, dates, '운동', USER_ID)
    const { data } = mockCreateMany.mock.calls[0][0]
    expect(data[0]).toMatchObject({
      title: '운동',
      recurringRuleId: RULE_ID,
      userId: USER_ID,
      completed: false,
      priority: 'medium',
      urgent: false,
    })
  })

  test('각 row의 date가 generateDates 결과와 일치', async () => {
    const dates = generateDates('weekly', [1, 3], undefined, START, daysRange(6))
    await createRecurringTodos(mockPrisma, RULE_ID, dates, '영어', USER_ID)
    const { data } = mockCreateMany.mock.calls[0][0]
    expect(data.map((r: any) => r.date)).toEqual(dates)
  })

  test('dates가 빈 배열이면 createMany에 빈 data 전달', async () => {
    await createRecurringTodos(mockPrisma, RULE_ID, [], '빈', USER_ID)
    const { data } = mockCreateMany.mock.calls[0][0]
    expect(data).toHaveLength(0)
  })

  test('반복(daily) + TODO 동시 생성 시나리오: generateDates 결과가 그대로 삽입', async () => {
    const end = daysRange(364)
    const dates = generateDates('daily', [], undefined, START, end)
    await createRecurringTodos(mockPrisma, RULE_ID, dates, '매일 기록', USER_ID)
    const { data } = mockCreateMany.mock.calls[0][0]
    expect(data).toHaveLength(365)
    expect(data[0].date).toEqual(dates[0])
    expect(data[364].date).toEqual(dates[364])
  })
})

// ── UTC 날짜 정확성 (timezone 버그 방지) ──────────────────────────────────────
// 버그 재현: setHours(0,0,0,0)는 로컬 자정 기준 → UTC+9에서 전날 15:00Z로 저장됨
// 수정: setUTCHours(0,0,0,0)으로 UTC 자정 보장

describe('generateDates - UTC 날짜 정확성', () => {
  // 2026-03-23 (월요일 UTC)
  const MONDAY_UTC = new Date('2026-03-23T00:00:00.000Z')
  // 2026-03-25 (수요일 UTC)
  const WEDNESDAY_UTC = new Date('2026-03-25T00:00:00.000Z')

  test('반환된 날짜의 UTC 시간이 자정(00:00:00Z)', () => {
    const end = new Date('2026-03-29T00:00:00.000Z')
    const dates = generateDates('weekly', [1, 3], undefined, MONDAY_UTC, end)
    dates.forEach(d => {
      expect(d.getUTCHours()).toBe(0)
      expect(d.getUTCMinutes()).toBe(0)
      expect(d.getUTCSeconds()).toBe(0)
    })
  })

  test('월(1) 선택 시 첫 번째 날짜의 UTC 날짜 문자열이 실제 월요일', () => {
    const end = new Date('2026-03-29T00:00:00.000Z')
    const dates = generateDates('weekly', [1], undefined, MONDAY_UTC, end)
    expect(dates[0].toISOString().slice(0, 10)).toBe('2026-03-23') // 월요일
  })

  test('수(3) 선택 시 UTC 날짜 문자열이 실제 수요일', () => {
    const end = new Date('2026-03-29T00:00:00.000Z')
    const dates = generateDates('weekly', [3], undefined, MONDAY_UTC, end)
    expect(dates[0].toISOString().slice(0, 10)).toBe('2026-03-25') // 수요일
  })

  test('월(1)+수(3) 선택 시 반환 날짜 순서가 월 → 수', () => {
    const end = new Date('2026-03-29T00:00:00.000Z')
    const dates = generateDates('weekly', [1, 3], undefined, MONDAY_UTC, end)
    expect(dates).toHaveLength(2)
    expect(dates[0].toISOString().slice(0, 10)).toBe('2026-03-23') // 월
    expect(dates[1].toISOString().slice(0, 10)).toBe('2026-03-25') // 수
  })

  test('4주치 월(1) 날짜가 모두 실제 월요일 (UTC 기준)', () => {
    const end = new Date('2026-04-19T00:00:00.000Z')
    const dates = generateDates('weekly', [1], undefined, MONDAY_UTC, end)
    const expectedMondays = [
      '2026-03-23', '2026-03-30', '2026-04-06', '2026-04-13',
    ]
    expect(dates.map(d => d.toISOString().slice(0, 10))).toEqual(expectedMondays)
  })

  test('daily 반복 시 모든 날짜가 UTC 자정', () => {
    const end = new Date('2026-03-25T00:00:00.000Z')
    const dates = generateDates('daily', [], undefined, MONDAY_UTC, end)
    dates.forEach(d => {
      expect(d.toISOString()).toMatch(/T00:00:00\.000Z$/)
    })
  })

  test('수요일 시작 시 수(3)만 선택하면 당일 포함', () => {
    const dates = generateDates('weekly', [3], undefined, WEDNESDAY_UTC, WEDNESDAY_UTC)
    expect(dates).toHaveLength(1)
    expect(dates[0].toISOString().slice(0, 10)).toBe('2026-03-25')
  })

  test('getISODay로 검증한 요일이 UTC 날짜 요일과 일치', () => {
    const end = new Date('2026-04-05T00:00:00.000Z')
    const dates = generateDates('weekly', [1, 3], undefined, MONDAY_UTC, end)
    dates.forEach(d => {
      const utcDay = d.getUTCDay() // 0=일, 1=월, ..., 3=수
      expect([1, 3]).toContain(utcDay) // 월(1) 또는 수(3)
    })
  })
})

// ── createRecurringTimelineEntries ────────────────────────────────────────────

describe('createRecurringTimelineEntries', () => {
  const RULE_ID = 'rule-2'
  const USER_ID = 'user-2'
  const RULE = { title: '영어화상통화', startTime: '22:50', endTime: '23:30', category: 'study' }

  test('dates 수만큼 row 생성', async () => {
    const dates = generateDates('weekly', [1, 3], undefined, START, daysRange(6))
    await createRecurringTimelineEntries(mockPrisma, RULE_ID, dates, RULE, USER_ID)
    const { data } = mockCreateMany.mock.calls[0][0]
    expect(data).toHaveLength(2) // 월, 수
  })

  test('각 row에 startTime, endTime, category, ruleId, userId 포함', async () => {
    const dates = generateDates('daily', [], undefined, START, START)
    await createRecurringTimelineEntries(mockPrisma, RULE_ID, dates, RULE, USER_ID)
    const { data } = mockCreateMany.mock.calls[0][0]
    expect(data[0]).toMatchObject({
      startTime: '22:50',
      endTime: '23:30',
      title: '영어화상통화',
      category: 'study',
      recurringRuleId: RULE_ID,
      userId: USER_ID,
    })
  })

  test('endTime null이면 row에도 null', async () => {
    const dates = generateDates('daily', [], undefined, START, START)
    await createRecurringTimelineEntries(mockPrisma, RULE_ID, dates, { ...RULE, endTime: null }, USER_ID)
    const { data } = mockCreateMany.mock.calls[0][0]
    expect(data[0].endTime).toBeNull()
  })

  test('category null이면 row에도 null', async () => {
    const dates = generateDates('daily', [], undefined, START, START)
    await createRecurringTimelineEntries(mockPrisma, RULE_ID, dates, { ...RULE, category: null }, USER_ID)
    const { data } = mockCreateMany.mock.calls[0][0]
    expect(data[0].category).toBeNull()
  })

  test('타임라인 + TODO 동시 반복 시나리오: 같은 dates로 양쪽 생성', async () => {
    const mockTodoCreateMany = jest.fn().mockResolvedValue({ count: 0 })
    const mockTimelineCreateMany = jest.fn().mockResolvedValue({ count: 0 })
    const dualPrisma = {
      todo: { createMany: mockTodoCreateMany },
      timelineEntry: { createMany: mockTimelineCreateMany },
    } as any

    const dates = generateDates('weekly', [1, 3], undefined, START, daysRange(27)) // 4주 × 2일 = 8
    await createRecurringTimelineEntries(dualPrisma, RULE_ID, dates, RULE, USER_ID)
    await createRecurringTodos(dualPrisma, RULE_ID, dates, RULE.title, USER_ID)

    expect(mockTimelineCreateMany.mock.calls[0][0].data).toHaveLength(8)
    expect(mockTodoCreateMany.mock.calls[0][0].data).toHaveLength(8)
    // 양쪽 row의 date가 동일
    const timelineDates = mockTimelineCreateMany.mock.calls[0][0].data.map((r: any) => r.date)
    const todoDates = mockTodoCreateMany.mock.calls[0][0].data.map((r: any) => r.date)
    expect(todoDates).toEqual(timelineDates)
  })
})
