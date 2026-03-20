'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { CalendarDays, FolderKanban, Flame } from 'lucide-react'

const navItems = [
  { href: '/', label: '주간 보드', sub: '할일 + 타임라인', icon: CalendarDays },
  { href: '/projects', label: '프로젝트', sub: '목표 관리', icon: FolderKanban },
  { href: '/habits', label: '습관 트래커', sub: '매일의 루틴', icon: Flame },
]

export default function Sidebar() {
  const pathname = usePathname()

  return (
    <aside
      className="fixed left-0 top-0 h-full w-60 flex flex-col z-50"
      style={{
        background: 'var(--bg-surface)',
        borderRight: '1px solid var(--border-dim)',
      }}
    >
      {/* Branding */}
      <div className="px-5 py-5" style={{ borderBottom: '1px solid var(--border-dim)' }}>
        <div className="flex items-center gap-3">
          <div
            className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 text-lg"
            style={{ background: 'var(--bg-hover)', border: '1px solid var(--border)' }}
          >
            📓
          </div>
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
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-4 space-y-0.5">
        {navItems.map((item) => {
          const Icon = item.icon
          const isActive = pathname === item.href
          return (
            <Link
              key={item.href}
              href={item.href}
              className="flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-150 group"
              style={{
                background: isActive ? 'var(--bg-hover)' : 'transparent',
                border: isActive ? '1px solid var(--border)' : '1px solid transparent',
                color: isActive ? 'var(--text-bright)' : 'var(--text-muted)',
              }}
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
              <div className="min-w-0">
                <div className="text-sm font-medium leading-tight">{item.label}</div>
                <div className="text-[10px] leading-tight mt-0.5" style={{ color: isActive ? 'var(--accent-dim)' : 'var(--text-dim)' }}>
                  {item.sub}
                </div>
              </div>
              {isActive && (
                <div
                  className="w-1 h-4 rounded-full ml-auto flex-shrink-0"
                  style={{ background: 'var(--accent)' }}
                />
              )}
            </Link>
          )
        })}
      </nav>

      {/* Footer */}
      <div className="px-5 py-4" style={{ borderTop: '1px solid var(--border-dim)' }}>
        <div className="flex items-center gap-2">
          <div className="w-1.5 h-1.5 rounded-full bg-[#95a586] animate-pulse" />
          <span className="text-[10px]" style={{ color: 'var(--text-dim)' }}>로컬 실행 중</span>
        </div>
      </div>
    </aside>
  )
}
