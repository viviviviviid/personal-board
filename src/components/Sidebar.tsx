'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { CalendarDays, FolderKanban, Flame, ChevronLeft, ChevronRight, LogOut, Settings } from 'lucide-react'
import { useSidebar } from '@/context/SidebarContext'
import { useSession, signOut } from 'next-auth/react'
import Image from 'next/image'
import { useState } from 'react'
import SettingsModal from './SettingsModal'

const navItems = [
  { href: '/', label: '보드', sub: '할일 + 타임라인', icon: CalendarDays },
  { href: '/projects', label: '프로젝트', sub: '목표 관리', icon: FolderKanban },
  { href: '/habits', label: '습관 트래커', sub: '매일의 루틴', icon: Flame },
]

export default function Sidebar() {
  const pathname = usePathname()
  const { isCollapsed, toggle } = useSidebar()
  const { data: session } = useSession()
  const [settingsOpen, setSettingsOpen] = useState(false)

  return (
    <>
    <SettingsModal isOpen={settingsOpen} onClose={() => setSettingsOpen(false)} />
    <aside
      className="hidden md:flex fixed left-0 top-0 h-full flex-col z-50 transition-all duration-200"
      style={{
        width: isCollapsed ? 48 : 240,
        background: 'var(--bg-surface)',
        borderRight: '1px solid var(--border-dim)',
      }}
    >
      {/* 상단 토글 버튼 */}
      <div
        className="flex items-center px-2 py-2"
        style={{
          borderBottom: '1px solid var(--border-dim)',
          justifyContent: isCollapsed ? 'center' : 'flex-end',
        }}
      >
        <button
          onClick={toggle}
          className="p-1.5 rounded-lg transition-all"
          style={{
            background: 'transparent',
            border: '1px solid transparent',
            color: 'var(--text-dim)',
          }}
          title={isCollapsed ? '사이드바 펼치기' : '사이드바 접기'}
          onMouseEnter={e => {
            e.currentTarget.style.background = 'var(--bg-hover)'
            e.currentTarget.style.borderColor = 'var(--border-dim)'
          }}
          onMouseLeave={e => {
            e.currentTarget.style.background = 'transparent'
            e.currentTarget.style.borderColor = 'transparent'
          }}
        >
          {isCollapsed ? <ChevronRight size={15} /> : <ChevronLeft size={15} />}
        </button>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-1.5 py-4 space-y-0.5">
        {navItems.map((item) => {
          const Icon = item.icon
          const isActive = pathname === item.href
          return (
            <Link
              key={item.href}
              href={item.href}
              className="flex items-center gap-3 px-2 py-2.5 rounded-xl transition-all duration-150 group"
              style={{
                background: isActive ? 'var(--bg-hover)' : 'transparent',
                border: isActive ? '1px solid var(--border)' : '1px solid transparent',
                color: isActive ? 'var(--text-bright)' : 'var(--text-muted)',
                justifyContent: isCollapsed ? 'center' : 'flex-start',
              }}
              title={isCollapsed ? item.label : undefined}
            >
              <div
                className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
                style={{
                  background: isActive ? 'var(--accent-dim)' : 'var(--bg-card)',
                  border: '1px solid var(--border-dim)',
                }}
              >
                <Icon
                  size={14}
                  style={{ color: isActive ? 'var(--accent-light)' : 'var(--text-dim)' }}
                />
              </div>
              {!isCollapsed && (
                <div className="min-w-0">
                  <div className="text-sm font-medium leading-tight">{item.label}</div>
                  <div className="text-[10px] leading-tight mt-0.5" style={{ color: isActive ? 'var(--accent-dim)' : 'var(--text-dim)' }}>
                    {item.sub}
                  </div>
                </div>
              )}
              {!isCollapsed && isActive && (
                <div
                  className="w-1 h-4 rounded-full ml-auto flex-shrink-0"
                  style={{ background: 'var(--accent)' }}
                />
              )}
            </Link>
          )
        })}
      </nav>

      {/* User + Footer */}
      <div className="px-3 py-4 flex flex-col gap-2" style={{ borderTop: '1px solid var(--border-dim)' }}>
        {/* 설정 버튼 */}
        <button
          onClick={() => setSettingsOpen(true)}
          className="flex items-center rounded-xl p-2 w-full transition-all"
          style={{
            gap: isCollapsed ? 0 : 8,
            justifyContent: isCollapsed ? 'center' : 'flex-start',
            background: 'transparent',
            border: '1px solid transparent',
            color: 'var(--text-dim)',
          }}
          title="설정"
          onMouseEnter={e => {
            e.currentTarget.style.background = 'var(--bg-hover)'
            e.currentTarget.style.borderColor = 'var(--border-dim)'
            e.currentTarget.style.color = 'var(--text)'
          }}
          onMouseLeave={e => {
            e.currentTarget.style.background = 'transparent'
            e.currentTarget.style.borderColor = 'transparent'
            e.currentTarget.style.color = 'var(--text-dim)'
          }}
        >
          <Settings size={15} className="flex-shrink-0" />
          {!isCollapsed && <span className="text-[12px] font-medium">설정</span>}
        </button>

        {/* User info */}
        {session?.user && (
          <div
            className="flex items-center rounded-xl p-2 transition-all"
            style={{
              gap: isCollapsed ? 0 : 8,
              justifyContent: isCollapsed ? 'center' : 'flex-start',
              background: 'var(--bg-card)',
              border: '1px solid var(--border-dim)',
            }}
          >
            {session.user.image ? (
              <Image
                src={session.user.image}
                alt={session.user.name ?? ''}
                width={24}
                height={24}
                className="rounded-full flex-shrink-0"
              />
            ) : (
              <div
                className="w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 text-[10px] font-bold"
                style={{ background: 'var(--accent-dim)', color: 'var(--accent-light)' }}
              >
                {session.user.name?.[0] ?? '?'}
              </div>
            )}
            {!isCollapsed && (
              <>
                <span
                  className="text-[11px] font-medium truncate flex-1 min-w-0"
                  style={{ color: 'var(--text)' }}
                >
                  {session.user.name}
                </span>
                <button
                  onClick={() => signOut({ callbackUrl: '/login' })}
                  className="flex-shrink-0 p-1 rounded-lg transition-all"
                  style={{ color: 'var(--text-dim)' }}
                  title="로그아웃"
                  onMouseEnter={e => (e.currentTarget.style.color = 'var(--danger, #ef4444)')}
                  onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-dim)')}
                >
                  <LogOut size={13} />
                </button>
              </>
            )}
          </div>
        )}

      </div>
    </aside>
    </>
  )
}
