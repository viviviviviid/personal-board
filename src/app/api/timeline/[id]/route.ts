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
    const { startTime, endTime, title, description, category, mode } = body

    const updateData: Record<string, unknown> = {}
    if (startTime !== undefined) updateData.startTime = startTime
    if (endTime !== undefined) updateData.endTime = endTime
    if (title !== undefined) updateData.title = title
    if (description !== undefined) updateData.description = description
    if (category !== undefined) updateData.category = category

    // mode=all: 같은 반복 규칙의 모든 인스턴스 + rule 자체도 업데이트
    if (mode === 'all') {
      const entry = await prisma.timelineEntry.findUnique({
        where: { id, userId: session.user.id },
        select: { recurringRuleId: true },
      })
      if (entry?.recurringRuleId) {
        const ruleUpdate: Record<string, unknown> = {}
        if (title !== undefined) ruleUpdate.title = title
        if (startTime !== undefined) ruleUpdate.startTime = startTime
        if (endTime !== undefined) ruleUpdate.endTime = endTime
        if (category !== undefined) ruleUpdate.category = category

        await Promise.all([
          prisma.timelineEntry.updateMany({
            where: { recurringRuleId: entry.recurringRuleId, userId: session.user.id },
            data: updateData,
          }),
          Object.keys(ruleUpdate).length > 0
            ? prisma.recurringRule.update({ where: { id: entry.recurringRuleId }, data: ruleUpdate })
            : Promise.resolve(),
        ])
        return NextResponse.json({ success: true, updatedSeries: true })
      }
    }

    const updated = await prisma.timelineEntry.update({
      where: { id, userId: session.user.id },
      data: updateData,
    })
    return NextResponse.json(updated)
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
    const { searchParams } = new URL(request.url)
    const mode = searchParams.get('mode') ?? 'all' // 기본값: 전체 (기존 동작 유지)

    const entry = await prisma.timelineEntry.findUnique({
      where: { id, userId: session.user.id },
      select: { recurringRuleId: true, date: true },
    })

    if (!entry) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    if (entry.recurringRuleId) {
      if (mode === 'single') {
        // 이 인스턴스만 삭제 (rule과 나머지 인스턴스 유지)
        await prisma.timelineEntry.delete({ where: { id, userId: session.user.id } })
        return NextResponse.json({ success: true })
      }
      if (mode === 'future') {
        // 이 날짜 이후 모든 인스턴스 삭제 (rule 유지)
        await prisma.timelineEntry.deleteMany({
          where: {
            recurringRuleId: entry.recurringRuleId,
            userId: session.user.id,
            date: { gte: entry.date! },
          },
        })
        return NextResponse.json({ success: true, deletedFuture: true })
      }
      // mode === 'all': rule 삭제 → cascade
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
