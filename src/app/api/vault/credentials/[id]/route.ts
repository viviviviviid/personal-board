import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { assertPro } from '@/lib/plan'
import { prisma } from '@/lib/prisma'

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const upgradeRes = await assertPro(session.user.id)
  if (upgradeRes) return upgradeRes
  const { id } = await params
  const body = await request.json()
  try {
    const updated = await prisma.credential.update({
      where: { id, userId: session.user.id },
      data: body,
    })
    return NextResponse.json(updated)
  } catch {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const upgradeRes = await assertPro(session.user.id)
  if (upgradeRes) return upgradeRes
  const { id } = await params
  try {
    await prisma.credential.delete({ where: { id, userId: session.user.id } })
    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }
}
