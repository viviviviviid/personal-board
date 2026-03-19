import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await request.json()
    const { name, emoji, color } = body

    const updateData: Record<string, unknown> = {}
    if (name !== undefined) updateData.name = name
    if (emoji !== undefined) updateData.emoji = emoji
    if (color !== undefined) updateData.color = color

    const habit = await prisma.habit.update({
      where: { id },
      data: updateData,
    })

    return NextResponse.json(habit)
  } catch (error) {
    console.error('Failed to update habit:', error)
    return NextResponse.json({ error: '습관 수정에 실패했습니다.' }, { status: 500 })
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    await prisma.habit.delete({
      where: { id },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Failed to delete habit:', error)
    return NextResponse.json({ error: '습관 삭제에 실패했습니다.' }, { status: 500 })
  }
}
