import { computeStreak, getWeekHistory } from '@/lib/habitUtils'

function makeDate(daysAgo: number): Date {
  const d = new Date('2026-03-20T12:00:00Z')
  d.setDate(d.getDate() - daysAgo)
  // Normalize to midnight UTC
  d.setUTCHours(0, 0, 0, 0)
  return d
}

const TODAY = new Date('2026-03-20T12:00:00Z')

describe('computeStreak', () => {
  test('returns 0 when no logs', () => {
    expect(computeStreak([], TODAY)).toBe(0)
  })

  test('returns 0 when today and yesterday not completed', () => {
    const logs = [{ date: makeDate(3), completed: true }]
    expect(computeStreak(logs, TODAY)).toBe(0)
  })

  test('counts streak of 1 when only today completed', () => {
    const logs = [{ date: makeDate(0), completed: true }]
    expect(computeStreak(logs, TODAY)).toBe(1)
  })

  test('counts consecutive days from today', () => {
    const logs = [
      { date: makeDate(0), completed: true },
      { date: makeDate(1), completed: true },
      { date: makeDate(2), completed: true },
    ]
    expect(computeStreak(logs, TODAY)).toBe(3)
  })

  test('stops streak at gap', () => {
    const logs = [
      { date: makeDate(0), completed: true },
      { date: makeDate(1), completed: true },
      // gap at day 2
      { date: makeDate(3), completed: true },
    ]
    expect(computeStreak(logs, TODAY)).toBe(2)
  })

  test('counts streak when yesterday completed but not today', () => {
    const logs = [{ date: makeDate(1), completed: true }]
    expect(computeStreak(logs, TODAY)).toBe(1)
  })

  test('ignores incomplete logs', () => {
    const logs = [
      { date: makeDate(0), completed: false },
      { date: makeDate(1), completed: true },
    ]
    // Today is not completed, yesterday is. Streak starts from yesterday.
    expect(computeStreak(logs, TODAY)).toBe(1)
  })

  test('long streak', () => {
    const logs = Array.from({ length: 10 }, (_, i) => ({
      date: makeDate(i),
      completed: true,
    }))
    expect(computeStreak(logs, TODAY)).toBe(10)
  })
})

describe('getWeekHistory', () => {
  test('returns 7 entries', () => {
    expect(getWeekHistory([], TODAY)).toHaveLength(7)
  })

  test('last entry is today', () => {
    const history = getWeekHistory([], TODAY)
    expect(history[6].date).toBe('2026-03-20')
  })

  test('first entry is 6 days ago', () => {
    const history = getWeekHistory([], TODAY)
    expect(history[0].date).toBe('2026-03-14')
  })

  test('marks completed days correctly', () => {
    const logs = [
      { date: makeDate(0), completed: true },  // today
      { date: makeDate(2), completed: true },  // 2 days ago
    ]
    const history = getWeekHistory(logs, TODAY)
    expect(history[6].completed).toBe(true)   // today
    expect(history[4].completed).toBe(true)   // 2 days ago
    expect(history[5].completed).toBe(false)  // yesterday
  })

  test('marks all false when no completed logs', () => {
    const logs = [{ date: makeDate(0), completed: false }]
    const history = getWeekHistory(logs, TODAY)
    expect(history.every(h => !h.completed)).toBe(true)
  })
})
