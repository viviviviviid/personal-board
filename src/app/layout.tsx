import type { Metadata } from 'next'
import { Caveat } from 'next/font/google'
import './globals.css'
import Sidebar from '@/components/Sidebar'

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
        <Sidebar />
        <main className="ml-60 min-h-screen p-4" style={{ height: '100vh', display: 'flex', flexDirection: 'column' }}>
          {children}
        </main>
      </body>
    </html>
  )
}
