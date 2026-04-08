import type { Metadata, Viewport } from 'next'
import { Caveat } from 'next/font/google'
import './globals.css'
import Sidebar from '@/components/Sidebar'
import SidebarWrapper from '@/components/SidebarWrapper'
import BottomNav from '@/components/BottomNav'
import { SidebarProvider } from '@/context/SidebarContext'
import { VaultProvider } from '@/context/VaultContext'
import { AutoFeedbackProvider } from '@/context/AutoFeedbackContext'
import SessionProviderWrapper from '@/components/SessionProviderWrapper'
import PWARegister from '@/components/PWARegister'
import AutoFeedbackTrigger from '@/components/AutoFeedbackTrigger'

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
    <html lang="ko" className={`h-full ${caveat.variable}`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: `(function(){try{var t=localStorage.getItem('theme');if(t)document.documentElement.setAttribute('data-theme',t)}catch(e){}})()` }} />
        <script dangerouslySetInnerHTML={{ __html: `(function(){try{if(window.__isNativeApp||navigator.userAgent.indexOf('PersonalBoardApp')!==-1){document.documentElement.setAttribute('data-native','true')}}catch(e){}})()` }} />
      </head>
      <body className="min-h-full antialiased">
        <SessionProviderWrapper>
          <AutoFeedbackProvider>
          <VaultProvider>
          <SidebarProvider>
            {/* 데스크탑 사이드바 */}
            <Sidebar />
            <SidebarWrapper>
              {children}
              <PWARegister />
            </SidebarWrapper>
            {/* 모바일 하단 탭 */}
            <BottomNav />
            <AutoFeedbackTrigger />
          </SidebarProvider>
          </VaultProvider>
          </AutoFeedbackProvider>
        </SessionProviderWrapper>
      </body>
    </html>
  )
}
