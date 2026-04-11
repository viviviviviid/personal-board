import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { getUserPlan } from '@/lib/plan'

export async function GET() {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const plan = await getUserPlan(session.user.id)
  return NextResponse.json({ plan })
}
