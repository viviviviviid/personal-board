import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { auth } from '@/lib/auth'
import { startOfDay, endOfDay, addDays, subWeeks, parseISO } from 'date-fns'
import { getUserPlan, FREE_LIMITS } from '@/lib/plan'
import { generateDates, createRecurringTimelineEntries, RECURRING_WINDOW_DAYS, type RecurringFreq } from '@/lib/recurring'

export async function GET(request: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const searchParams = request.nextUrl.searchParams
    const dateParam = searchParams.get('date')
    const weekParam = searchParams.get('week')
    const startDateParam = searchParams.get('startDate')
    const endDateParam = searchParams.get('endDate')

    const plan = await getUserPlan(session.user.id)
    if (plan === 'free') {
      const requestedDateParam = weekParam ?? dateParam ?? startDateParam
      if (requestedDateParam) {
        const cutoff = subWeeks(new Date(), FREE_LIMITS.timelineWeeks)
        if (parseISO(requestedDateParam) < cutoff) {
          return NextResponse.json(
            { error: 'Free plan: history limited to 4 weeks', code: 'UPGRADE_REQUIRED' },
            { status: 402 }
          )
        }
      }
    }

    if (startDateParam && endDateParam) {
      const entries = await prisma.timelineEntry.findMany({
        where: {
          userId: session.user.id,
          date: {
            gte: startOfDay(new Date(startDateParam)),
            lte: endOfDay(new Date(endDateParam)),
          },
        },
        orderBy: [{ date: 'asc' }, { startTime: 'asc' }],
      })
      return NextResponse.json(entries)
    }

    if (weekParam) {
      const weekStart = new Date(weekParam)
      const weekEnd = addDays(weekStart, 6)
      const entries = await prisma.timelineEntry.findMany({
        where: {
          userId: session.user.id,
          date: {
            gte: startOfDay(weekStart),
            lte: endOfDay(weekEnd),
          },
        },
        orderBy: { startTime: 'asc' },
      })
      return NextResponse.json(entries)
    }

    const date = dateParam ? new Date(dateParam) : new Date()

    const entries = await prisma.timelineEntry.findMany({
      where: {
        userId: session.user.id,
        date: {
          gte: startOfDay(date),
          lte: endOfDay(date),
        },
      },
      orderBy: { startTime: 'asc' },
    })

    return NextResponse.json(entries)
  } catch (error) {
    console.error('Failed to fetch timeline entries:', error)
    return NextResponse.json({ error: 'DB 연결에 실패했습니다.' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await request.json()
    const { date, startTime, endTime, title, description, category,
            recurring, freq, weekDays, monthDay, hideFromMonthly } = body

    if (!startTime || !title) {
      return NextResponse.json({ error: '시작 시간, 제목은 필수입니다.' }, { status: 400 })
    }

    if (recurring && freq) {
      const rule = await prisma.recurringRule.create({
        data: {
          userId: session.user.id,
          type: 'timeline',
          freq: freq as RecurringFreq,
          weekDays: weekDays?.length ? JSON.stringify(weekDays) : null,
          monthDay: monthDay ?? null,
          title,
          startTime,
          endTime: endTime ?? null,
          category: category ?? null,
        },
      })
      const start = date ? new Date(date) : new Date()
      const end = addDays(start, RECURRING_WINDOW_DAYS)
      const parsedWeekDays: number[] = weekDays ?? []
      const dates = generateDates(freq as RecurringFreq, parsedWeekDays, monthDay, start, end)
      await createRecurringTimelineEntries(prisma, rule.id, dates, { title, startTime, endTime, category, hideFromMonthly: !!hideFromMonthly }, session.user.id)
      return NextResponse.json({ recurringRuleId: rule.id, count: dates.length }, { status: 201 })
    }

    if (!date) {
      return NextResponse.json({ error: '날짜는 필수입니다.' }, { status: 400 })
    }

    const entry = await prisma.timelineEntry.create({
      data: {
        date: new Date(date),
        startTime,
        endTime,
        title,
        description,
        category,
        hideFromMonthly: !!hideFromMonthly,
        userId: session.user.id,
      },
    })

    return NextResponse.json(entry, { status: 201 })
  } catch (error) {
    console.error('Failed to create timeline entry:', error)
    return NextResponse.json({ error: '타임라인 항목 생성에 실패했습니다.' }, { status: 500 })
  }
}
