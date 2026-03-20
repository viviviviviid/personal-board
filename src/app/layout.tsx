import type { Metadata } from 'next'
import { Caveat } from 'next/font/google'
import './globals.css'
import Sidebar from '@/components/Sidebar'
import SidebarWrapper from '@/components/SidebarWrapper'
import { SidebarProvider } from '@/context/SidebarContext'
import SessionProviderWrapper from '@/components/SessionProviderWrapper'

const caveat = Caveat({
  subsets: ['latin'],
  variable: '--font-caveat',
})

export const metadata: Metadata = {
  title: 'My Dashboard',
  description: '개인 생산성 대시보드',
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
            <Sidebar />
            <SidebarWrapper>{children}</SidebarWrapper>
          </SidebarProvider>
        </SessionProviderWrapper>
      </body>
    </html>
  )
}
