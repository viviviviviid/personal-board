import type { Metadata, Viewport } from 'next'
import { Caveat } from 'next/font/google'
import './globals.css'
import Sidebar from '@/components/Sidebar'
import SidebarWrapper from '@/components/SidebarWrapper'
import BottomNav from '@/components/BottomNav'
import { SidebarProvider } from '@/context/SidebarContext'
import SessionProviderWrapper from '@/components/SessionProviderWrapper'
import PWARegister from '@/components/PWARegister'

const caveat = Caveat({
  subsets: ['latin'],
  variable: '--font-caveat',
})

export const metadata: Metadata = {
  title: 'Personal Board',
  description: '개인 생산성 대시보드',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'Board',
  },
}

export const viewport: Viewport = {
  themeColor: '#8B5CF6',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="ko" className={`h-full ${caveat.variable}`}>
      <body className="min-h-full antialiased">
        <SessionProviderWrapper>
          <SidebarProvider>
            {/* 데스크탑 사이드바 */}
            <Sidebar />
            <SidebarWrapper>
              {children}
              <PWARegister />
            </SidebarWrapper>
            {/* 모바일 하단 탭 */}
            <BottomNav />
          </SidebarProvider>
        </SessionProviderWrapper>
      </body>
    </html>
  )
}
