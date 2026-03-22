import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { auth } from '@/lib/auth'
export async function POST(request: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await request.json()
    const { habitId, date, completed } = body

    if (!habitId || !date) {
      return NextResponse.json({ error: '습관 ID와 날짜는 필수입니다.' }, { status: 400 })
    }

    const dateObj = new Date(date)
    dateObj.setUTCHours(0, 0, 0, 0)

    const log = await prisma.habitLog.upsert({
      where: {
        habitId_date: {
          habitId,
          date: dateObj,
        },
      },
      update: {
        completed: completed ?? true,
      },
      create: {
        habitId,
        date: dateObj,
        completed: completed ?? true,
      },
    })

    return NextResponse.json(log)
  } catch (error) {
    console.error('Failed to log habit:', error)
    return NextResponse.json({ error: '습관 기록에 실패했습니다.' }, { status: 500 })
  }
}
