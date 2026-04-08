import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import crypto from 'crypto'

export async function POST(request: Request) {
  const { idToken } = await request.json()

  if (!idToken) {
    return NextResponse.json({ error: 'idToken required' }, { status: 400 })
  }

  // Google tokeninfo API로 ID 토큰 검증
  const res = await fetch(
    `https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(idToken)}`
  )
  if (!res.ok) {
    return NextResponse.json({ error: 'Invalid token' }, { status: 401 })
  }

  const payload = await res.json()

  // audience가 우리 앱의 클라이언트 ID인지 확인
  const validAudiences = [
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_IOS_CLIENT_ID,
    process.env.GOOGLE_ANDROID_CLIENT_ID,
  ].filter(Boolean)

  if (!validAudiences.includes(payload.aud)) {
    return NextResponse.json({ error: 'Invalid audience' }, { status: 401 })
  }

  const { sub: googleId, email, name, picture } = payload

  if (!email) {
    return NextResponse.json({ error: 'Email not provided' }, { status: 400 })
  }

  // 유저 찾기 또는 생성
  let user = await prisma.user.findFirst({
    where: { accounts: { some: { provider: 'google', providerAccountId: googleId } } },
  })

  if (!user) {
    user = await prisma.user.findUnique({ where: { email } }) ?? null

    if (!user) {
      user = await prisma.user.create({
        data: { email, name, image: picture },
      })
    }

    await prisma.account.upsert({
      where: { provider_providerAccountId: { provider: 'google', providerAccountId: googleId } },
      update: {},
      create: {
        userId: user.id,
        type: 'oauth',
        provider: 'google',
        providerAccountId: googleId,
      },
    })
  }

  // 세션 생성
  const sessionToken = crypto.randomBytes(32).toString('hex')
  const expires = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) // 30일

  await prisma.session.create({
    data: { sessionToken, userId: user.id, expires },
  })

  return NextResponse.json({ sessionToken, expires: expires.toISOString() })
}
