import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { auth } from '@/lib/auth'
import { subDays } from 'date-fns'
import { computeStreak, getWeekHistory, getHeatmapHistory } from '@/lib/habitUtils'

export async function GET(request: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const searchParams = request.nextUrl.searchParams
    const dateParam = searchParams.get('date')
    const date = dateParam ? new Date(dateParam) : new Date()
    date.setUTCHours(0, 0, 0, 0)

    const rangeStart = subDays(date, 210)
    const rangeEnd = new Date(date)
    rangeEnd.setUTCHours(23, 59, 59, 999)

    const habits = await prisma.habit.findMany({
      where: {
        userId: session.user.id,
        createdAt: { lte: rangeEnd }, // 조회 날짜 이전에 생성된 습관만
      },
      orderBy: { createdAt: 'asc' },
      include: {
        logs: {
          where: {
            date: {
              gte: rangeStart,
              lte: rangeEnd,
            },
          },
          orderBy: { date: 'desc' },
        },
      },
    })

    const todayStart = date
    const todayEnd = rangeEnd

    const result = habits.map(habit => {
      const todayLogs = habit.logs.filter(
        l => l.date >= todayStart && l.date <= todayEnd
      )
      const streak = computeStreak(habit.logs, date)
      const weekHistory = getWeekHistory(habit.logs, date)
      const heatmapHistory = getHeatmapHistory(habit.logs, date)
      return {
        ...habit,
        logs: todayLogs,
        streak,
        weekHistory,
        heatmapHistory,
      }
    })

    return NextResponse.json(result)
  } catch (error) {
    console.error('Failed to fetch habits:', error)
    return NextResponse.json({ error: 'DB 연결에 실패했습니다.' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await request.json()
    const { name, emoji, color } = body

    if (!name) {
      return NextResponse.json({ error: '습관 이름은 필수입니다.' }, { status: 400 })
    }

    const habit = await prisma.habit.create({
      data: {
        name,
        emoji,
        color: color || '#10b981',
        userId: session.user.id,
      },
    })

    return NextResponse.json(habit, { status: 201 })
  } catch (error) {
    console.error('Failed to create habit:', error)
    return NextResponse.json({ error: '습관 생성에 실패했습니다.' }, { status: 500 })
  }
}
