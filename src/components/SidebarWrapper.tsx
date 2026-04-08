'use client'

import { useSidebar } from '@/context/SidebarContext'
import { useEffect, useState } from 'react'

export default function SidebarWrapper({ children }: { children: React.ReactNode }) {
  const { isCollapsed } = useSidebar()
  const [isMobile, setIsMobile] = useState(false)
  const [isNativeApp, setIsNativeApp] = useState(false)

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768)
    check()
    window.addEventListener('resize', check)
    return () => window.removeEventListener('resize', check)
  }, [])

  useEffect(() => {
    setIsNativeApp(document.documentElement.getAttribute('data-native') === 'true')
  }, [])

  return (
    <main
      className="min-h-screen p-3 md:p-4 transition-all duration-200"
      style={{
        marginLeft: isMobile ? 0 : isCollapsed ? 48 : 240,
        paddingBottom: isMobile && !isNativeApp ? 80 : 16,
        height: '100vh',
        overflowY: 'auto',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      {children}
    </main>
  )
}
