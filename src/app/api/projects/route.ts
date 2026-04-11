import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { auth } from '@/lib/auth'
import { getUserPlan, FREE_LIMITS } from '@/lib/plan'

export async function GET() {
  try {
    const session = await auth()
    if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const projects = await prisma.project.findMany({
      where: { userId: session.user.id },
      orderBy: { createdAt: 'desc' },
      include: {
        _count: {
          select: { todos: true },
        },
        todos: {
          select: { id: true, completed: true },
        },
      },
    })

    const projectsWithStats = projects.map((p) => ({
      ...p,
      totalTodos: p._count.todos,
      completedTodos: p.todos.filter((t) => t.completed).length,
    }))

    return NextResponse.json(projectsWithStats)
  } catch (error) {
    console.error('Failed to fetch projects:', error)
    return NextResponse.json({ error: 'DB 연결에 실패했습니다.' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await request.json()
    const { name, description, color, goal } = body

    if (!name) {
      return NextResponse.json({ error: '프로젝트 이름은 필수입니다.' }, { status: 400 })
    }

    const plan = await getUserPlan(session.user.id)
    if (plan === 'free') {
      const count = await prisma.project.count({ where: { userId: session.user.id } })
      if (count >= FREE_LIMITS.projects) {
        return NextResponse.json(
          { error: 'Free plan limit reached', code: 'UPGRADE_REQUIRED' },
          { status: 402 }
        )
      }
    }

    const project = await prisma.project.create({
      data: {
        name,
        description,
        color: color || '#6366f1',
        goal,
        userId: session.user.id,
      },
    })

    return NextResponse.json(project, { status: 201 })
  } catch (error) {
    console.error('Failed to create project:', error)
    return NextResponse.json({ error: '프로젝트 생성에 실패했습니다.' }, { status: 500 })
  }
}
