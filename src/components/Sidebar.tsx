'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { CalendarDays, FolderKanban, Flame } from 'lucide-react'

const navItems = [
  { href: '/', label: '주간 보드', icon: CalendarDays, desc: '할일 + 타임라인' },
  { href: '/projects', label: '프로젝트', icon: FolderKanban, desc: '목표 관리' },
  { href: '/habits', label: '습관 트래커', icon: Flame, desc: '매일의 루틴' },
]

export default function Sidebar() {
  const pathname = usePathname()

  return (
    <aside className="fixed left-0 top-0 h-full w-60 bg-[#0a0a1a] border-r border-[#1e1e3a] flex flex-col z-50">
      {/* Branding */}
      <div className="px-5 py-5 border-b border-[#1e1e3a]">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center flex-shrink-0">
            <span className="text-sm">⚡</span>
          </div>
          <div>
            <h1 className="text-sm font-bold text-white leading-tight">My Dashboard</h1>
            <p className="text-[10px] text-[#5050a0] mt-0.5">생산성 관리</p>
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 space-y-0.5">
        {navItems.map((item) => {
          const Icon = item.icon
          const isActive = pathname === item.href
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm transition-all duration-150 group ${
                isActive
                  ? 'bg-indigo-600/20 text-indigo-300 border border-indigo-500/30'
                  : 'text-[#7070a8] hover:bg-[#141430] hover:text-[#c0c0e8] border border-transparent'
              }`}
            >
              <div className={`w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 transition-all ${
                isActive ? 'bg-indigo-500/20' : 'bg-[#1a1a30] group-hover:bg-[#1e1e38]'
              }`}>
                <Icon size={15} className={isActive ? 'text-indigo-400' : 'text-[#5555a0] group-hover:text-[#8888cc]'} />
              </div>
              <div className="min-w-0">
                <div className="font-medium leading-tight">{item.label}</div>
                <div className={`text-[10px] leading-tight mt-0.5 ${isActive ? 'text-indigo-400/60' : 'text-[#4040a0]'}`}>{item.desc}</div>
              </div>
            </Link>
          )
        })}
      </nav>

      {/* Footer */}
      <div className="px-4 py-4 border-t border-[#1e1e3a]">
        <div className="flex items-center gap-2">
          <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
          <span className="text-[10px] text-[#3a3a70]">로컬 실행 중</span>
        </div>
      </div>
    </aside>
  )
}
