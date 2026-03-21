import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { getValidGoogleToken } from '@/lib/google-token'

export interface GoogleCalendar {
  id: string
  summary: string
  backgroundColor: string
  foregroundColor: string
  primary?: boolean
}

export async function GET() {
  try {
    const session = await auth()
    if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const accessToken = await getValidGoogleToken(session.user.id)
    if (!accessToken) {
      return NextResponse.json({ calendars: [], status: 'no_token' })
    }

    const res = await fetch(
      'https://www.googleapis.com/calendar/v3/users/me/calendarList?minAccessRole=reader',
      { headers: { Authorization: `Bearer ${accessToken}` } }
    )

    if (!res.ok) {
      const errBody = await res.json().catch(() => ({}))
      console.error('Google Calendar list error:', res.status, errBody)
      // 403 = scope 부족 → 캘린더 미연결과 동일하게 처리
      if (res.status === 403 || res.status === 401) {
        return NextResponse.json({ calendars: [], status: 'no_token' })
      }
      return NextResponse.json({ calendars: [], status: 'api_error', code: res.status })
    }

    const data = await res.json()
    const calendars: GoogleCalendar[] = (data.items ?? []).map((c: GoogleCalendar) => ({
      id: c.id,
      summary: c.summary,
      backgroundColor: c.backgroundColor ?? '#4285F4',
      foregroundColor: c.foregroundColor ?? '#ffffff',
      primary: c.primary ?? false,
    }))

    return NextResponse.json({ calendars, status: 'ok' })
  } catch (error) {
    console.error('Failed to fetch calendar list:', error)
    return NextResponse.json({ calendars: [], status: 'error' })
  }
}
