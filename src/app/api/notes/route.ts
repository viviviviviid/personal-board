import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { getUserPlan, FREE_LIMITS } from '@/lib/plan'

export async function GET(request: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const searchParams = request.nextUrl.searchParams
    const q = searchParams.get('q')?.slice(0, 200)
    const tag = searchParams.get('tag')?.slice(0, 100)

    const notes = await prisma.note.findMany({
      where: {
        userId: session.user.id,
        ...(q && {
          OR: [
            { title: { contains: q } },
            { content: { contains: q } },
          ],
        }),
        ...(tag && { tags: { contains: tag } }),
      },
      orderBy: [{ pinned: 'desc' }, { updatedAt: 'desc' }],
    })

    return NextResponse.json(notes)
  } catch (error) {
    console.error('Failed to fetch notes:', error)
    return NextResponse.json({ error: '메모 불러오기 실패' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { title, content, tags, date, pinned } = await request.json()
    if (content === undefined || content === null) {
      return NextResponse.json({ error: 'content required' }, { status: 400 })
    }

    const plan = await getUserPlan(session.user.id)
    if (plan === 'free') {
      const count = await prisma.note.count({ where: { userId: session.user.id } })
      if (count >= FREE_LIMITS.notes) {
        return NextResponse.json(
          { error: 'Free plan limit reached', code: 'UPGRADE_REQUIRED' },
          { status: 402 }
        )
      }
    }

    const note = await prisma.note.create({
      data: {
        userId: session.user.id,
        title: title ?? null,
        content,
        tags: tags ?? null,
        date: date ?? null,
        pinned: pinned ?? false,
      },
    })

    return NextResponse.json(note, { status: 201 })
  } catch (error) {
    console.error('Failed to create note:', error)
    return NextResponse.json({ error: '메모 생성 실패' }, { status: 500 })
  }
}
