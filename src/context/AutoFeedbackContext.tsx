'use client'
import { createContext, useContext, useState } from 'react'

interface AutoFeedbackContextValue {
  todayFeedback: string | null
  setTodayFeedback: (f: string | null) => void
}

const AutoFeedbackContext = createContext<AutoFeedbackContextValue | null>(null)

export function AutoFeedbackProvider({ children }: { children: React.ReactNode }) {
  const [todayFeedback, setTodayFeedback] = useState<string | null>(null)
  return (
    <AutoFeedbackContext.Provider value={{ todayFeedback, setTodayFeedback }}>
      {children}
    </AutoFeedbackContext.Provider>
  )
}

export function useAutoFeedback() {
  const ctx = useContext(AutoFeedbackContext)
  if (!ctx) throw new Error('useAutoFeedback must be used within AutoFeedbackProvider')
  return ctx
}
