import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET() {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const credentials = await prisma.credential.findMany({
    where: { userId: session.user.id },
    orderBy: [{ pinned: 'desc' }, { updatedAt: 'desc' }],
  })
  return NextResponse.json(credentials)
}

export async function POST(request: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { name, type, encryptedValue, iv, description, pinned } = await request.json()
  if (!name || !encryptedValue || !iv) return NextResponse.json({ error: 'name, encryptedValue, iv required' }, { status: 400 })
  const credential = await prisma.credential.create({
    data: { userId: session.user.id, name, type: type ?? 'password', encryptedValue, iv, description: description ?? null, pinned: pinned ?? false },
  })
  return NextResponse.json(credential, { status: 201 })
}
