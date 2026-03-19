import type { Metadata } from 'next'
import './globals.css'
import Sidebar from '@/components/Sidebar'

export const metadata: Metadata = {
  title: 'My Dashboard - 생산성 관리',
  description: '개인 생산성 대시보드',
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="ko" className="h-full">
      <body className="min-h-full bg-[#13132a] text-[#e8e8f8] antialiased">
        <Sidebar />
        <main className="ml-60 min-h-screen p-4" style={{ height: '100vh', display: 'flex', flexDirection: 'column' }}>
          {children}
        </main>
      </body>
    </html>
  )
}
