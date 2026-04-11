import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { assertPro } from '@/lib/plan'
import { prisma } from '@/lib/prisma'

export async function GET() {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const upgradeRes = await assertPro(session.user.id)
  if (upgradeRes) return upgradeRes
  const config = await prisma.vaultConfig.findUnique({ where: { userId: session.user.id } })
  if (!config) return NextResponse.json({ exists: false })
  return NextResponse.json({ exists: true, salt: config.salt, verifier: config.verifier })
}

export async function POST(request: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const upgradeRes = await assertPro(session.user.id)
  if (upgradeRes) return upgradeRes
  const { salt, verifier } = await request.json()
  if (!salt || !verifier) return NextResponse.json({ error: 'salt and verifier required' }, { status: 400 })
  const existing = await prisma.vaultConfig.findUnique({ where: { userId: session.user.id } })
  if (existing) return NextResponse.json({ error: 'Already configured' }, { status: 409 })
  const config = await prisma.vaultConfig.create({ data: { userId: session.user.id, salt, verifier } })
  return NextResponse.json(config, { status: 201 })
}
