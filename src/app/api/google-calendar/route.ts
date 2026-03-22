import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { getValidGoogleToken } from '@/lib/google-token'

interface RawEvent {
  id: string
  summary?: string
  start?: { dateTime?: string; date?: string }
  end?: { dateTime?: string; date?: string }
}

async function fetchCalendarEvents(
  accessToken: string,
  calendarId: string,
  timeMin: string,
  timeMax: string,
  calendarColor: string,
) {
  const url = new URL(
    `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events`
  )
  url.searchParams.set('timeMin', timeMin)
  url.searchParams.set('timeMax', timeMax)
  url.searchParams.set('singleEvents', 'true')
  url.searchParams.set('orderBy', 'startTime')
  url.searchParams.set('maxResults', '50')

  const res = await fetch(url.toString(), {
    headers: { Authorization: `Bearer ${accessToken}` },
  })

  if (!res.ok) return []

  const data = await res.json()
  return (data.items ?? [])
    .filter((e: RawEvent) => e.start?.dateTime || e.start?.date)
    .map((e: RawEvent) => {
      const allDay = !e.start?.dateTime
      return {
        id: `${calendarId}::${e.id}`,
        summary: e.summary,
        start: allDay ? { date: e.start!.date! } : { dateTime: e.start!.dateTime! },
        end: allDay ? { date: e.end?.date ?? e.start!.date! } : { dateTime: e.end?.dateTime ?? e.start!.dateTime! },
        calendarId,
        calendarColor,
        allDay,
      }
    })
}

export async function GET(request: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { searchParams } = request.nextUrl
    const timeMin = searchParams.get('timeMin')
    const timeMax = searchParams.get('timeMax')
    const calendarIdsParam = searchParams.get('calendarIds') // comma-separated
    const colorsParam = searchParams.get('calendarColors') // comma-separated, same order

    if (!timeMin || !timeMax) {
      return NextResponse.json({ error: 'timeMin and timeMax are required' }, { status: 400 })
    }

    const accessToken = await getValidGoogleToken(session.user.id)
    if (!accessToken) return NextResponse.json({ events: [] })

    const calendarIds = calendarIdsParam ? calendarIdsParam.split(',') : ['primary']
    const colors = colorsParam ? colorsParam.split(',') : calendarIds.map(() => '#4285F4')

    const results = await Promise.all(
      calendarIds.map((calId, i) =>
        fetchCalendarEvents(accessToken, calId, timeMin, timeMax, colors[i] ?? '#4285F4')
      )
    )

    const events = results.flat().sort((a, b) => {
      const aTime = a.allDay ? new Date(a.start.date!).getTime() : new Date(a.start.dateTime!).getTime()
      const bTime = b.allDay ? new Date(b.start.date!).getTime() : new Date(b.start.dateTime!).getTime()
      return aTime - bTime
    })

    return NextResponse.json({ events })
  } catch (error) {
    console.error('Failed to fetch Google Calendar events:', error)
    return NextResponse.json({ events: [] })
  }
}
