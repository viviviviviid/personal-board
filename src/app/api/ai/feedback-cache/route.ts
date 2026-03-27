import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET(request: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const date = request.nextUrl.searchParams.get('date')
  if (!date) return NextResponse.json({ error: 'date required' }, { status: 400 })
  const cache = await prisma.aiFeedbackCache.findUnique({
    where: { userId_date: { userId: session.user.id, date } },
  })
  return NextResponse.json(cache ?? null)
}

export async function POST(request: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { date, feedback, dataTypes } = await request.json()
  if (!date || !feedback) return NextResponse.json({ error: 'date and feedback required' }, { status: 400 })
  const cache = await prisma.aiFeedbackCache.upsert({
    where: { userId_date: { userId: session.user.id, date } },
    update: { feedback, dataTypes: JSON.stringify(dataTypes ?? []) },
    create: { userId: session.user.id, date, feedback, dataTypes: JSON.stringify(dataTypes ?? []) },
  })
  return NextResponse.json(cache)
}
