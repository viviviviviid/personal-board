import { useRef } from 'react'

interface KeyboardInputHandlers {
  submit?: () => void
  cancel?: () => void
}

/**
 * 한글/일본어 등 조합형 입력(IME) 중 Enter/Escape 키 처리
 *
 * 사용 예:
 * ```tsx
 * const handlers = useKeyboardInput()
 *
 * <input
 *   {...handlers.handlers}
 *   onKeyDown={(e) => handlers.onKeyDown(e, {
 *     submit: () => { ... },
 *     cancel: () => { ... }
 *   })}
 * />
 * ```
 */
export function useKeyboardInput() {
  const isComposing = useRef(false)

  const onCompositionStart = () => {
    isComposing.current = true
  }

  const onCompositionEnd = () => {
    isComposing.current = false
  }

  const onKeyDown = (e: React.KeyboardEvent, handlers: KeyboardInputHandlers) => {
    // IME 조합 중이면 무시
    if (isComposing.current) return

    if (e.key === 'Enter') {
      e.preventDefault()
      handlers.submit?.()
    }

    if (e.key === 'Escape') {
      e.preventDefault()
      handlers.cancel?.()
    }
  }

  // 인라인 props로 사용 가능하도록 export
  const handlers = {
    onCompositionStart,
    onCompositionEnd,
  }

  return {
    handlers,
    onKeyDown,
    isComposing: () => isComposing.current,
  }
}
