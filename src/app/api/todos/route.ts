import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { startOfDay, endOfDay, startOfWeek, endOfWeek, addDays } from 'date-fns'

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const dateParam = searchParams.get('date')
    const weekParam = searchParams.get('week')

    let where: Record<string, unknown> = {}

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
