'use client'
import { useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { useAutoFeedback } from '@/context/AutoFeedbackContext'

export default function AutoFeedbackTrigger() {
  const { data: session } = useSession()
  const { setTodayFeedback } = useAutoFeedback()

  useEffect(() => {
    if (!session?.user) return
    const enabled = localStorage.getItem('ai-auto-feedback') === 'true'
    if (!enabled) return

    const today = new Date().toISOString().slice(0, 10)

    ;(async () => {
      // Check if today's feedback already cached
      const cacheRes = await fetch(`/api/ai/feedback-cache?date=${today}`)
      const cache = await cacheRes.json()
      if (cache?.feedback) {
        setTodayFeedback(cache.feedback)
        return
      }

      // Generate: weekStart = 6 days ago
      const weekStart = new Date()
      weekStart.setDate(weekStart.getDate() - 6)
      const weekStartStr = weekStart.toISOString().slice(0, 10)

      const dataTypes = JSON.parse(localStorage.getItem('ai-feedback-data-types') ?? '["todos","timeline","habits","highlights"]')

      const res = await fetch('/api/ai/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ weekStart: weekStartStr, dataTypes }),
      })
      if (!res.ok) return

      const { feedback } = await res.json()
      if (!feedback) return

      // Save to cache
      await fetch('/api/ai/feedback-cache', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ date: today, feedback, dataTypes }),
      })
      setTodayFeedback(feedback)
    })()
  }, [session, setTodayFeedback])

  return null
}
