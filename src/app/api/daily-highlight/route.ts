import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { auth } from '@/lib/auth'
import { format, addDays } from 'date-fns'

export async function GET(request: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const week = request.nextUrl.searchParams.get('week')
    if (!week) return NextResponse.json({ error: 'week required' }, { status: 400 })

    const dates = Array.from({ length: 7 }, (_, i) =>
      format(addDays(new Date(week), i), 'yyyy-MM-dd')
    )

    const highlights = await prisma.dailyHighlight.findMany({
      where: { userId: session.user.id, date: { in: dates } },
    })

    return NextResponse.json(highlights)
  } catch (error) {
    console.error('Failed to fetch highlights:', error)
    return NextResponse.json({ error: 'Failed' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { date, content, completed } = await request.json()
    if (!date || !content?.trim()) return NextResponse.json({ error: 'date and content required' }, { status: 400 })

    const highlight = await prisma.dailyHighlight.upsert({
      where: { userId_date: { userId: session.user.id, date } },
      update: { content: content.trim(), ...(completed !== undefined && { completed }) },
      create: { userId: session.user.id, date, content: content.trim() },
    })

    return NextResponse.json(highlight)
  } catch (error) {
    console.error('Failed to upsert highlight:', error)
    return NextResponse.json({ error: 'Failed' }, { status: 500 })
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { date, content, completed } = await request.json()
    if (!date) return NextResponse.json({ error: 'date required' }, { status: 400 })

    const data: Record<string, unknown> = {}
    if (content !== undefined) data.content = content.trim()
    if (completed !== undefined) data.completed = completed

    const highlight = await prisma.dailyHighlight.update({
      where: { userId_date: { userId: session.user.id, date } },
      data,
    })

    return NextResponse.json(highlight)
  } catch (error) {
    console.error('Failed to update highlight:', error)
    return NextResponse.json({ error: 'Failed' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const date = request.nextUrl.searchParams.get('date')
    if (!date) return NextResponse.json({ error: 'date required' }, { status: 400 })

    await prisma.dailyHighlight.delete({
      where: { userId_date: { userId: session.user.id, date } },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Failed to delete highlight:', error)
    return NextResponse.json({ error: 'Failed' }, { status: 500 })
  }
}
