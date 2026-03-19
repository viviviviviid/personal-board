import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { startOfDay, endOfDay } from 'date-fns'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { habitId, date, completed } = body

    if (!habitId || !date) {
      return NextResponse.json({ error: '습관 ID와 날짜는 필수입니다.' }, { status: 400 })
    }

    const dateObj = new Date(date)

    const log = await prisma.habitLog.upsert({
      where: {
        habitId_date: {
          habitId,
          date: startOfDay(dateObj),
        },
      },
      update: {
        completed: completed ?? true,
      },
      create: {
        habitId,
        date: startOfDay(dateObj),
        completed: completed ?? true,
      },
    })

    return NextResponse.json(log)
  } catch (error) {
    console.error('Failed to log habit:', error)
    return NextResponse.json({ error: '습관 기록에 실패했습니다.' }, { status: 500 })
  }
}
