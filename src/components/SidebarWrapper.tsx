'use client'

import { useSidebar } from '@/context/SidebarContext'
import { useEffect, useState } from 'react'
import { usePathname } from 'next/navigation'

// 패딩·스크롤 없이 전체 공간을 스스로 관리하는 full-page 레이아웃 경로
const FULL_PAGE_ROUTES = ['/notes']

export default function SidebarWrapper({ children }: { children: React.ReactNode }) {
  const { isCollapsed } = useSidebar()
  const pathname = usePathname()
  const [isMobile, setIsMobile] = useState(false)

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768)
    check()
    window.addEventListener('resize', check)
    return () => window.removeEventListener('resize', check)
  }, [])

  const isFullPage = FULL_PAGE_ROUTES.some(r => pathname.startsWith(r))

  return (
    <main
      className={`transition-all duration-200 ${isFullPage ? '' : 'min-h-screen p-3 md:p-4'}`}
      style={{
        marginLeft: isMobile ? 0 : isCollapsed ? 48 : 240,
        paddingBottom: isFullPage ? 0 : 16,
        height: '100dvh',
        overflowY: isFullPage ? 'hidden' : 'auto',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      {children}
    </main>
  )
}
