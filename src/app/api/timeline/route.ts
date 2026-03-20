import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { auth } from '@/lib/auth'
import { startOfDay, endOfDay, addDays } from 'date-fns'

export async function GET(request: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const searchParams = request.nextUrl.searchParams
    const dateParam = searchParams.get('date')
    const weekParam = searchParams.get('week')

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
    const { date, startTime, endTime, title, description, category } = body

    if (!date || !startTime || !title) {
      return NextResponse.json({ error: '날짜, 시작 시간, 제목은 필수입니다.' }, { status: 400 })
    }

    const entry = await prisma.timelineEntry.create({
      data: {
        date: new Date(date),
        startTime,
        endTime,
        title,
        description,
        category,
        userId: session.user.id,
      },
    })

    return NextResponse.json(entry, { status: 201 })
  } catch (error) {
    console.error('Failed to create timeline entry:', error)
    return NextResponse.json({ error: '타임라인 항목 생성에 실패했습니다.' }, { status: 500 })
  }
}
