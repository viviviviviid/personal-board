'use client'

import { createContext, useContext, useCallback, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'

type BackHandler = () => boolean // true = handled, false = continue to next

interface BackNavigationContextType {
  registerHandler: (id: string, handler: BackHandler, priority?: number) => void
  unregisterHandler: (id: string) => void
}

const BackNavigationContext = createContext<BackNavigationContextType | undefined>(undefined)

export function BackNavigationProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const handlersRef = useRef<Map<string, { handler: BackHandler; priority: number }>>(new Map())

  const registerHandler = useCallback((id: string, handler: BackHandler, priority = 0) => {
    handlersRef.current.set(id, { handler, priority })
  }, [])

  const unregisterHandler = useCallback((id: string) => {
    handlersRef.current.delete(id)
  }, [])

  const triggerBack = useCallback(() => {
    // 우선순위 높은 것부터 정렬
    const sorted = Array.from(handlersRef.current.entries())
      .sort(([, a], [, b]) => b.priority - a.priority)

    // 각 핸들러에 물어보기 (true = handled)
    for (const [, { handler }] of sorted) {
      if (handler()) return
    }

    // 아무도 처리하지 않으면 라우터 뒤로
    router.back()
  }, [router])

  useEffect(() => {
    // 브라우저 백버튼 & 하드웨어 백버튼 처리
    const handlePopState = () => triggerBack()
    const handleBackPressed = () => triggerBack()

    window.addEventListener('popstate', handlePopState)
    window.addEventListener('personalboard:backPressed', handleBackPressed)

    return () => {
      window.removeEventListener('popstate', handlePopState)
      window.removeEventListener('personalboard:backPressed', handleBackPressed)
    }
  }, [triggerBack])

  return (
    <BackNavigationContext.Provider value={{ registerHandler, unregisterHandler }}>
      {children}
    </BackNavigationContext.Provider>
  )
}

export function useBackNavigation() {
  const ctx = useContext(BackNavigationContext)
  if (!ctx) {
    throw new Error('useBackNavigation must be used within BackNavigationProvider')
  }
  return ctx
}
