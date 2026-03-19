import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { startOfDay, endOfDay } from 'date-fns'

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const dateParam = searchParams.get('date')
    const date = dateParam ? new Date(dateParam) : new Date()

    const habits = await prisma.habit.findMany({
      orderBy: { createdAt: 'asc' },
      include: {
        logs: {
          where: {
            date: {
              gte: startOfDay(date),
              lte: endOfDay(date),
            },
          },
        },
      },
    })

    return NextResponse.json(habits)
  } catch (error) {
    console.error('Failed to fetch habits:', error)
    return NextResponse.json({ error: 'DB 연결에 실패했습니다.' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
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
      },
    })

    return NextResponse.json(habit, { status: 201 })
  } catch (error) {
    console.error('Failed to create habit:', error)
    return NextResponse.json({ error: '습관 생성에 실패했습니다.' }, { status: 500 })
  }
}
