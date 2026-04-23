import { useEffect } from 'react'

/**
 * 모달이 열려있을 때 배경 스크롤을 방지하고
 * 모달 닫을 때 스크롤 위치를 복원
 *
 * 사용 예:
 * ```tsx
 * useScrollLock(isModalOpen)
 * ```
 */
export function useScrollLock(isLocked: boolean) {
  useEffect(() => {
    if (!isLocked) return

    // 현재 스크롤 위치 저장
    const scrollY = window.scrollY
    const scrollbarWidth = window.innerWidth - document.documentElement.clientWidth

    // 스크롤 방지 + 스크롤바 공간 유지
    document.body.style.overflow = 'hidden'
    document.body.style.paddingRight = `${scrollbarWidth}px`

    // 정리 함수: 모달 닫힐 때 복원
    return () => {
      document.body.style.overflow = ''
      document.body.style.paddingRight = ''
      window.scrollTo(0, scrollY)
    }
  }, [isLocked])
}
