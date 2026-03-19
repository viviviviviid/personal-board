'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { CalendarDays, Clock, FolderKanban, Flame } from 'lucide-react'

const navItems = [
  { href: '/', label: '주간 보드', icon: CalendarDays },
  { href: '/timeline', label: '타임라인', icon: Clock },
  { href: '/projects', label: '프로젝트', icon: FolderKanban },
  { href: '/habits', label: '오늘의 습관', icon: Flame },
]

export default function Sidebar() {
  const pathname = usePathname()

  return (
    <aside className="fixed left-0 top-0 h-full w-60 bg-[#0f0f22] border-r border-[#252550] flex flex-col z-50">
      <div className="px-5 py-6 border-b border-[#252550]">
        <h1 className="text-lg font-bold text-white flex items-center gap-2">
          <span className="text-xl">📋</span>
          <span className="bg-gradient-to-r from-indigo-400 to-purple-400 bg-clip-text text-transparent">
            My Dashboard
          </span>
        </h1>
        <p className="text-xs text-[#6060a0] mt-1">생산성 관리 대시보드</p>
      </div>

      <nav className="flex-1 px-3 py-4 space-y-1">
        {navItems.map((item) => {
          const Icon = item.icon
          const isActive = pathname === item.href
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150 ${
                isActive
                  ? 'bg-indigo-600/25 text-indigo-300 border border-indigo-500/40'
                  : 'text-[#8888bb] hover:bg-[#1e1e40] hover:text-[#ccccee]'
              }`}
            >
              <Icon size={18} className={isActive ? 'text-indigo-400' : 'text-[#6060a0]'} />
              {item.label}
            </Link>
          )
        })}
      </nav>

      <div className="px-4 py-4 border-t border-[#252550]">
        <div className="text-xs text-[#3a3a70] text-center">
          Personal Productivity v1.0
        </div>
      </div>
    </aside>
  )
}
