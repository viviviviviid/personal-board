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
    if (!accessToken) return NextResponse.json({ calendars: [] })

    const res = await fetch(
      'https://www.googleapis.com/calendar/v3/users/me/calendarList?minAccessRole=reader',
      { headers: { Authorization: `Bearer ${accessToken}` } }
    )

    if (!res.ok) return NextResponse.json({ calendars: [] })

    const data = await res.json()
    const calendars: GoogleCalendar[] = (data.items ?? []).map((c: GoogleCalendar) => ({
      id: c.id,
      summary: c.summary,
      backgroundColor: c.backgroundColor ?? '#4285F4',
      foregroundColor: c.foregroundColor ?? '#ffffff',
      primary: c.primary ?? false,
    }))

    return NextResponse.json({ calendars })
  } catch (error) {
    console.error('Failed to fetch calendar list:', error)
    return NextResponse.json({ calendars: [] })
  }
}
