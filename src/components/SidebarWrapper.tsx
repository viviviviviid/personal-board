'use client'

import { useSidebar } from '@/context/SidebarContext'

export default function SidebarWrapper({ children }: { children: React.ReactNode }) {
  const { isCollapsed } = useSidebar()
  return (
    <main
      className="min-h-screen p-4 transition-all duration-200"
      style={{
        marginLeft: isCollapsed ? 48 : 240,
        height: '100vh',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      {children}
    </main>
  )
}
