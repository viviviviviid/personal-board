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
    const startDateParam = searchParams.get('startDate')
    const endDateParam = searchParams.get('endDate')

    const where: Record<string, unknown> = { userId: session.user.id }

    if (dateParam) {
      const date = new Date(dateParam)
      where.date = {
        gte: startOfDay(date),
        lte: endOfDay(date),
      }
    } else if (weekParam) {
      const weekStart = new Date(weekParam)
      const weekEnd = addDays(weekStart, 6)
      where.date = {
        gte: startOfDay(weekStart),
        lte: endOfDay(weekEnd),
      }
    } else if (startDateParam && endDateParam) {
      where.date = {
        gte: startOfDay(new Date(startDateParam)),
        lte: endOfDay(new Date(endDateParam)),
      }
    }

    const todos = await prisma.todo.findMany({
      where,
      orderBy: [{ date: 'asc' }, { createdAt: 'asc' }],
      include: {
        project: {
          select: { id: true, name: true, color: true },
        },
      },
    })

    return NextResponse.json(todos)
  } catch (error) {
    console.error('Failed to fetch todos:', error)
    return NextResponse.json({ error: 'DB 연결에 실패했습니다.' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await request.json()
    const { title, description, priority, date, projectId, sectionId } = body

    if (!title) {
      return NextResponse.json({ error: '제목은 필수입니다.' }, { status: 400 })
    }

    const todo = await prisma.todo.create({
      data: {
        title,
        description,
        priority: priority || 'medium',
        date: date ? new Date(date) : null,
        projectId: projectId || null,
        sectionId: sectionId || null,
        userId: session.user.id,
      },
      include: {
        project: {
          select: { id: true, name: true, color: true },
        },
      },
    })

    return NextResponse.json(todo, { status: 201 })
  } catch (error) {
    console.error('Failed to create todo:', error)
    return NextResponse.json({ error: '할일 생성에 실패했습니다.' }, { status: 500 })
  }
}
