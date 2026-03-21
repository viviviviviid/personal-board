import { addDays, getISODay } from 'date-fns'
import { PrismaClient } from '@prisma/client'

export type RecurringFreq = 'daily' | 'weekdays' | 'weekly' | 'monthly'

export const RECURRING_WINDOW_DAYS = 365

export function generateDates(
  freq: RecurringFreq,
  weekDays: number[],
  monthDay: number | undefined,
  startDate: Date,
  endDate: Date,
): Date[] {
  const result: Date[] = []
  let current = new Date(startDate)
  current.setHours(0, 0, 0, 0)
  const end = new Date(endDate)
  end.setHours(23, 59, 59, 999)

  while (current <= end) {
    const isoDay = getISODay(current) // 1=월...7=일
    let matches = false
    if (freq === 'daily') matches = true
    else if (freq === 'weekdays') matches = isoDay <= 5
    else if (freq === 'weekly') matches = weekDays.includes(isoDay)
    else if (freq === 'monthly') matches = current.getDate() === monthDay
    if (matches) result.push(new Date(current))
    current = addDays(current, 1)
  }
  return result
}

export async function createRecurringTodos(
  prisma: PrismaClient,
  ruleId: string,
  dates: Date[],
  title: string,
  userId: string,
): Promise<void> {
  await prisma.todo.createMany({
    data: dates.map(d => ({
      title,
      date: d,
      recurringRuleId: ruleId,
      userId,
      completed: false,
      priority: 'medium',
      urgent: false,
    })),
  })
}

export async function createRecurringTimelineEntries(
  prisma: PrismaClient,
  ruleId: string,
  dates: Date[],
  rule: { title: string; startTime: string; endTime?: string | null; category?: string | null },
  userId: string,
): Promise<void> {
  await prisma.timelineEntry.createMany({
    data: dates.map(d => ({
      date: d,
      startTime: rule.startTime,
      endTime: rule.endTime ?? null,
      title: rule.title,
      category: rule.category ?? null,
      recurringRuleId: ruleId,
      userId,
    })),
  })
}
