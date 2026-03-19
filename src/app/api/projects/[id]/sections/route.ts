import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: projectId } = await params
    const body = await request.json()
    const { title } = body

    if (!title) {
      return NextResponse.json({ error: '섹션 이름은 필수입니다.' }, { status: 400 })
    }

    const existingSections = await prisma.projectSection.count({
      where: { projectId },
    })

    const section = await prisma.projectSection.create({
      data: {
        title,
        projectId,
        order: existingSections,
      },
      include: {
        todos: true,
      },
    })

    return NextResponse.json(section, { status: 201 })
  } catch (error) {
    console.error('Failed to create section:', error)
    return NextResponse.json({ error: '섹션 생성에 실패했습니다.' }, { status: 500 })
  }
}
