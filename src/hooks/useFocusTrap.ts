import { useEffect, useRef } from 'react'

export function useFocusTrap(isActive: boolean) {
  const containerRef = useRef<HTMLDivElement>(null)
  const firstButtonRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (!isActive || !containerRef.current) return

    // 초기 포커스: firstButtonRef 또는 첫 포커스 가능한 요소
    const focusInitially = () => {
      if (firstButtonRef.current) {
        firstButtonRef.current.focus()
      } else {
        const focusables = containerRef.current?.querySelectorAll(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        )
        if (focusables?.length) {
          (focusables[0] as HTMLElement).focus()
        }
      }
    }

    const timer = setTimeout(focusInitially, 0)

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Tab') return

      const focusables = Array.from(
        containerRef.current?.querySelectorAll(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        ) || []
      ) as HTMLElement[]

      if (focusables.length === 0) return

      const currentIndex = focusables.indexOf(document.activeElement as HTMLElement)

      if (e.shiftKey) {
        if (currentIndex <= 0) {
          e.preventDefault()
          focusables[focusables.length - 1].focus()
        }
      } else {
        if (currentIndex >= focusables.length - 1) {
          e.preventDefault()
          focusables[0].focus()
        }
      }
    }

    document.addEventListener('keydown', handleKeyDown)

    return () => {
      clearTimeout(timer)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [isActive])

  return { containerRef, firstButtonRef }
}
