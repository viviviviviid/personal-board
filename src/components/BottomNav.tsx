'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { CalendarDays, FolderKanban, Flame, NotebookPen, User } from 'lucide-react'
import { useSession } from 'next-auth/react'
import Image from 'next/image'
import { useState, useEffect } from 'react'
import SettingsModal from './SettingsModal'

const navItems = [
  { href: '/', label: '보드', icon: CalendarDays },
  { href: '/projects', label: '프로젝트', icon: FolderKanban },
  { href: '/habits', label: '습관', icon: Flame },
  { href: '/notes', label: '메모', icon: NotebookPen },
]

export default function BottomNav() {
  const pathname = usePathname()
  const { data: session } = useSession()
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [isNativeApp, setIsNativeApp] = useState(false)

  useEffect(() => {
    setIsNativeApp(navigator.userAgent.includes('PersonalBoardApp'))
  }, [])

  useEffect(() => {
    if (!isNativeApp) return
    const handler = () => setSettingsOpen(true)
    window.addEventListener('personalboard:openSettings', handler)
    return () => window.removeEventListener('personalboard:openSettings', handler)
  }, [isNativeApp])

  useEffect(() => {
    setSettingsOpen(false)
  }, [pathname])

  const handleSettingsClose = () => {
    setSettingsOpen(false)
    if (isNativeApp && (window as any).flutter_inappwebview) {
      ;(window as any).flutter_inappwebview.callHandler('personalBoardBridge', { action: 'settingsClosed' })
    }
  }

  // 2뎁스 이상(예: /projects/[id])에서는 하단 탭 숨김
  const isDeepPath = /^\/[^/]+\/[^/]+/.test(pathname)

  if (isNativeApp) return <SettingsModal isOpen={settingsOpen} onClose={handleSettingsClose} />
  if (isDeepPath) return null

  return (
    <>
    <SettingsModal isOpen={settingsOpen} onClose={handleSettingsClose} />
    <nav
      className="bottom-nav-mobile md:hidden fixed bottom-0 left-0 right-0 z-50 flex items-stretch"
      style={{
        background: 'var(--bg-surface)',
        borderTop: '1px solid var(--border-dim)',
        paddingBottom: 'env(safe-area-inset-bottom)',
      }}
    >
      {navItems.map(item => {
        const Icon = item.icon
        const isActive = pathname === item.href
        return (
          <Link
            key={item.href}
            href={item.href}
            className="flex-1 flex flex-col items-center justify-center py-2 gap-0.5 transition-all"
            style={{ color: isActive ? 'var(--accent-light)' : 'var(--text-dim)' }}
          >
            <div
              className="w-8 h-8 flex items-center justify-center rounded-xl transition-all"
              style={{ background: isActive ? 'var(--accent-dim)' : 'transparent' }}
            >
              <Icon size={18} />
            </div>
            <span className="text-[10px] font-medium">{item.label}</span>
          </Link>
        )
      })}

      {/* 계정 버튼 */}
      <button
        onClick={() => setSettingsOpen(true)}
        className="flex-1 flex flex-col items-center justify-center py-2 gap-0.5 transition-all"
        style={{ color: 'var(--text-dim)' }}
      >
        <div className="w-8 h-8 flex items-center justify-center rounded-xl">
          {session?.user?.image ? (
            <Image
              src={session.user.image}
              alt={session.user.name ?? ''}
              width={28}
              height={28}
              className="rounded-full"
            />
          ) : session?.user ? (
            <div
              className="w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-bold"
              style={{ background: 'var(--accent-dim)', color: 'var(--accent-light)' }}
            >
              {session.user.name?.[0] ?? '?'}
            </div>
          ) : (
            <User size={18} />
          )}
        </div>
        <span className="text-[10px] font-medium">
          {session?.user ? session.user.name?.split(' ')[0] ?? '나' : '계정'}
        </span>
      </button>
    </nav>
    </>
  )
}
