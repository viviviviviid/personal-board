'use client'

import { createContext, useContext, useCallback, useRef, useEffect, useState } from 'react'

export interface Modal {
  id: string
  priority: number
  zIndex: number
}

interface ModalStackContextType {
  modals: Modal[]
  openModal: (id: string, priority?: number) => void
  closeModal: (id: string) => void
  closeTopModal: () => void
  isModalOpen: (id: string) => boolean
  getTopModal: () => Modal | null
}

const ModalStackContext = createContext<ModalStackContextType | undefined>(undefined)
const BASE_Z_INDEX = 100

export function ModalStackProvider({ children }: { children: React.ReactNode }) {
  const [modals, setModals] = useState<Modal[]>([])
  const counterRef = useRef(BASE_Z_INDEX)

  const openModal = useCallback((id: string, priority = 0) => {
    setModals(prev => {
      // 이미 열려있으면 무시
      if (prev.some(m => m.id === id)) return prev

      const newZIndex = counterRef.current++
      const newModal: Modal = { id, priority, zIndex: newZIndex }

      // 우선순위 높은 순서로 정렬
      const sorted = [...prev, newModal].sort((a, b) => b.priority - a.priority)

      // z-index 재정렬
      return sorted.map((m, idx) => ({
        ...m,
        zIndex: BASE_Z_INDEX + idx,
      }))
    })
  }, [])

  const closeModal = useCallback((id: string) => {
    setModals(prev => prev.filter(m => m.id !== id))
  }, [])

  const closeTopModal = useCallback(() => {
    setModals(prev => {
      if (prev.length === 0) return prev
      return prev.slice(1)
    })
  }, [])

  const isModalOpen = useCallback((id: string) => {
    return modals.some(m => m.id === id)
  }, [modals])

  const getTopModal = useCallback(() => {
    return modals[0] || null
  }, [modals])

  // ESC 키로 최상단 모달 닫기
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && modals.length > 0) {
        e.preventDefault()
        closeTopModal()
      }
    }

    // 모달이 있을 때만 리스너 추가
    if (modals.length > 0) {
      document.addEventListener('keydown', handleKeyDown)
      return () => document.removeEventListener('keydown', handleKeyDown)
    }
  }, [modals.length, closeTopModal])

  // 모달 열려있을 때 body 스크롤 제어
  useEffect(() => {
    if (modals.length > 0) {
      const scrollbarWidth = window.innerWidth - document.documentElement.clientWidth
      document.body.style.overflow = 'hidden'
      document.body.style.paddingRight = `${scrollbarWidth}px`
    } else {
      document.body.style.overflow = ''
      document.body.style.paddingRight = ''
    }

    return () => {
      document.body.style.overflow = ''
      document.body.style.paddingRight = ''
    }
  }, [modals.length])

  return (
    <ModalStackContext.Provider
      value={{
        modals,
        openModal,
        closeModal,
        closeTopModal,
        isModalOpen,
        getTopModal,
      }}
    >
      {children}
    </ModalStackContext.Provider>
  )
}

export function useModalStack() {
  const ctx = useContext(ModalStackContext)
  if (!ctx) {
    throw new Error('useModalStack must be used within ModalStackProvider')
  }
  return ctx
}
