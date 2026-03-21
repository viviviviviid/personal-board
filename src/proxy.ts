import { auth } from '@/lib/auth'
import { NextResponse } from 'next/server'

export const proxy = auth(request => {
  const { pathname } = request.nextUrl

  // API 라우트는 각자 auth 처리 (401 반환), proxy는 패스
  if (pathname.startsWith('/api/')) return NextResponse.next()

  // 공개 페이지
  if (pathname.startsWith('/login')) return NextResponse.next()

  // 비로그인 → 로그인 페이지로
  if (!request.auth) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  return NextResponse.next()
})

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|manifest\\.webmanifest|icon.*\\.png|sw\\.js).*)'],
}
