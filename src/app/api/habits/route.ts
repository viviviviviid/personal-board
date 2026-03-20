import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { auth } from '@/lib/auth'
import { startOfDay, endOfDay, subDays } from 'date-fns'
import { computeStreak, getWeekHistory } from '@/lib/habitUtils'

export async function GET(request: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const searchParams = request.nextUrl.searchParams
    const dateParam = searchParams.get('date')
    const date = dateParam ? new Date(dateParam) : new Date()

    const habits = await prisma.habit.findMany({
      where: { userId: session.user.id },
      orderBy: { createdAt: 'asc' },
      include: {
        logs: {
          where: {
            date: {
              gte: startOfDay(subDays(date, 90)),
              lte: endOfDay(date),
            },
          },
          orderBy: { date: 'desc' },
        },
      },
    })

    const todayStart = startOfDay(date)
    const todayEnd = endOfDay(date)

    const result = habits.map(habit => {
      const todayLogs = habit.logs.filter(
        l => l.date >= todayStart && l.date <= todayEnd
      )
      const streak = computeStreak(habit.logs, date)
      const weekHistory = getWeekHistory(habit.logs, date)
      return {
        ...habit,
        logs: todayLogs,
        streak,
        weekHistory,
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
