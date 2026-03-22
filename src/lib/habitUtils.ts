import { format, subDays } from 'date-fns'

export function getHeatmapHistory(
  logs: LogEntry[],
  today: Date,
  nDays = 210
): { date: string; completed: boolean }[] {
  const completedDates = new Set(
    logs.filter(l => l.completed).map(l => format(l.date, 'yyyy-MM-dd'))
  )
  return Array.from({ length: nDays }, (_, i) => {
    const d = subDays(today, nDays - 1 - i)
    const dateStr = format(d, 'yyyy-MM-dd')
    return { date: dateStr, completed: completedDates.has(dateStr) }
  })
}

export interface LogEntry {
  date: Date
  completed: boolean
}

export function computeStreak(logs: LogEntry[], today: Date): number {
  const completedDates = new Set(
    logs.filter(l => l.completed).map(l => format(l.date, 'yyyy-MM-dd'))
  )
  const todayStr = format(today, 'yyyy-MM-dd')
  const yesterdayStr = format(subDays(today, 1), 'yyyy-MM-dd')

  // Streak is only active if today or yesterday was completed
  if (!completedDates.has(todayStr) && !completedDates.has(yesterdayStr)) return 0

  let streak = 0
  let checkDate = completedDates.has(todayStr) ? today : subDays(today, 1)

  while (completedDates.has(format(checkDate, 'yyyy-MM-dd'))) {
    streak++
    checkDate = subDays(checkDate, 1)
  }

  return streak
}

export function getWeekHistory(
  logs: LogEntry[],
  today: Date
): { date: string; completed: boolean }[] {
  const completedDates = new Set(
    logs.filter(l => l.completed).map(l => format(l.date, 'yyyy-MM-dd'))
  )
  return Array.from({ length: 7 }, (_, i) => {
    const d = subDays(today, 6 - i)
    const dateStr = format(d, 'yyyy-MM-dd')
    return { date: dateStr, completed: completedDates.has(dateStr) }
  })
}
