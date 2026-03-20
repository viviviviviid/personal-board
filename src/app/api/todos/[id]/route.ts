import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { auth } from '@/lib/auth'

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth()
    if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { id } = await params
    const body = await request.json()
    const { title, completed, date, priority, urgent, projectId, sectionId, description } = body

    const updateData: Record<string, unknown> = {}
    if (title !== undefined) updateData.title = title
    if (completed !== undefined) updateData.completed = completed
    if (date !== undefined) updateData.date = date ? new Date(date) : null
    if (priority !== undefined) updateData.priority = priority
    if (urgent !== undefined) updateData.urgent = urgent
    if (projectId !== undefined) updateData.projectId = projectId
    if (sectionId !== undefined) updateData.sectionId = sectionId
    if (description !== undefined) updateData.description = description

    const todo = await prisma.todo.update({
      where: { id, userId: session.user.id },
      data: updateData,
      include: {
        project: {
          select: { id: true, name: true, color: true },
        },
      },
    })

    return NextResponse.json(todo)
  } catch (error) {
    console.error('Failed to update todo:', error)
    return NextResponse.json({ error: '할일 수정에 실패했습니다.' }, { status: 500 })
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth()
    if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { id } = await params

    await prisma.todo.delete({
      where: { id, userId: session.user.id },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Failed to delete todo:', error)
    return NextResponse.json({ error: '할일 삭제에 실패했습니다.' }, { status: 500 })
  }
}
