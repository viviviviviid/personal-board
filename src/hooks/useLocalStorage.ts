import { useState, useEffect, useCallback } from 'react'

/**
 * 타입 안전한 로컬스토리지 훅
 * 자동 직렬화/역직렬화, 타입 체크
 *
 * 사용 예:
 * ```tsx
 * const [view, setView] = useLocalStorage<'weekly' | 'monthly'>('board:view', 'weekly')
 * const [calendars, setCalendars] = useLocalStorage<string[]>('board:calendars', [])
 * ```
 */
export function useLocalStorage<T>(key: string, initialValue: T) {
  const [storedValue, setStoredValue] = useState<T>(() => {
    try {
      const item = typeof window !== 'undefined' ? window.localStorage.getItem(key) : null
      return item ? JSON.parse(item) : initialValue
    } catch {
      console.warn(`Failed to read localStorage key "${key}"`)
      return initialValue
    }
  })

  const setValue = useCallback(
    (value: T | ((val: T) => T)) => {
      try {
        const valueToStore = value instanceof Function ? value(storedValue) : value
        setStoredValue(valueToStore)
        window.localStorage.setItem(key, JSON.stringify(valueToStore))
      } catch {
        console.warn(`Failed to write to localStorage key "${key}"`)
      }
    },
    [key, storedValue]
  )

  const removeValue = useCallback(() => {
    try {
      window.localStorage.removeItem(key)
      setStoredValue(initialValue)
    } catch {
      console.warn(`Failed to remove localStorage key "${key}"`)
    }
  }, [key, initialValue])

  return [storedValue, setValue, removeValue] as const
}
