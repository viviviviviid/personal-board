import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { auth } from '@/lib/auth'

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; sectionId: string }> }
) {
  try {
    const session = await auth()
    if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { sectionId } = await params
    const body = await request.json()
    const { title, isOpen } = body

    const updateData: Record<string, unknown> = {}
    if (title !== undefined) updateData.title = title
    if (isOpen !== undefined) updateData.isOpen = isOpen

    const section = await prisma.projectSection.update({
      where: { id: sectionId },
      data: updateData,
    })

    return NextResponse.json(section)
  } catch (error) {
    console.error('Failed to update section:', error)
    return NextResponse.json({ error: '섹션 수정에 실패했습니다.' }, { status: 500 })
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; sectionId: string }> }
) {
  try {
    const session = await auth()
    if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { sectionId } = await params

    await prisma.projectSection.delete({ where: { id: sectionId } })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Failed to delete section:', error)
    return NextResponse.json({ error: '섹션 삭제에 실패했습니다.' }, { status: 500 })
  }
}
