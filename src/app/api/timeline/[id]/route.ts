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
    const { startTime, endTime, title, description, category } = body

    const updateData: Record<string, unknown> = {}
    if (startTime !== undefined) updateData.startTime = startTime
    if (endTime !== undefined) updateData.endTime = endTime
    if (title !== undefined) updateData.title = title
    if (description !== undefined) updateData.description = description
    if (category !== undefined) updateData.category = category

    const entry = await prisma.timelineEntry.update({
      where: { id, userId: session.user.id },
      data: updateData,
    })

    return NextResponse.json(entry)
  } catch (error) {
    console.error('Failed to update timeline entry:', error)
    return NextResponse.json({ error: '타임라인 항목 수정에 실패했습니다.' }, { status: 500 })
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

    const entry = await prisma.timelineEntry.findUnique({
      where: { id, userId: session.user.id },
      select: { recurringRuleId: true },
    })

    if (entry?.recurringRuleId) {
      await prisma.recurringRule.delete({ where: { id: entry.recurringRuleId } })
      return NextResponse.json({ success: true, deletedSeries: true })
    }

    await prisma.timelineEntry.delete({ where: { id, userId: session.user.id } })
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Failed to delete timeline entry:', error)
    return NextResponse.json({ error: '타임라인 항목 삭제에 실패했습니다.' }, { status: 500 })
  }
}
