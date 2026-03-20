'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { CalendarDays, FolderKanban, Flame, ChevronLeft, ChevronRight, LogOut } from 'lucide-react'
import { useSidebar } from '@/context/SidebarContext'
import { useSession, signOut } from 'next-auth/react'
import Image from 'next/image'

const navItems = [
  { href: '/', label: '보드', sub: '할일 + 타임라인', icon: CalendarDays },
  { href: '/projects', label: '프로젝트', sub: '목표 관리', icon: FolderKanban },
  { href: '/habits', label: '습관 트래커', sub: '매일의 루틴', icon: Flame },
]

export default function Sidebar() {
  const pathname = usePathname()
  const { isCollapsed, toggle } = useSidebar()
  const { data: session } = useSession()

  return (
    <aside
      className="fixed left-0 top-0 h-full flex flex-col z-50 transition-all duration-200"
      style={{
        width: isCollapsed ? 48 : 240,
        background: 'var(--bg-surface)',
        borderRight: '1px solid var(--border-dim)',
      }}
    >
      {/* Branding */}
      <div
        className="px-3 py-5 flex items-center transition-all duration-200"
        style={{ borderBottom: '1px solid var(--border-dim)', gap: isCollapsed ? 0 : 12 }}
      >
        <div
          className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 text-lg"
          style={{ background: 'var(--bg-hover)', border: '1px solid var(--border)' }}
        >
          📓
        </div>
        {!isCollapsed && (
          <div>
            <h1
              className="font-hand text-xl leading-tight"
              style={{ color: 'var(--accent-light)' }}
            >
              My Dashboard
            </h1>
            <p className="text-[10px] mt-0.5" style={{ color: 'var(--text-dim)' }}>
              생산성 노트
            </p>
          </div>
        )}
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

        {/* Collapse toggle */}
        <button
          onClick={toggle}
          className="w-full flex items-center justify-center p-1.5 rounded-lg transition-all"
          style={{
            background: 'var(--bg-hover)',
            border: '1px solid var(--border-dim)',
            color: 'var(--text-dim)',
          }}
          title={isCollapsed ? '사이드바 펼치기' : '사이드바 접기'}
        >
          {isCollapsed ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
        </button>
      </div>
    </aside>
  )
}
