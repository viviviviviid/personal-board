'use client'

import { useEffect, useState } from 'react'
import { Download } from 'lucide-react'

export default function PWARegister() {
  const [installPrompt, setInstallPrompt] = useState<Event | null>(null)
  const [isStandalone, setIsStandalone] = useState(false)

  useEffect(() => {
    // 이미 설치된 경우
    setIsStandalone(window.matchMedia('(display-mode: standalone)').matches)

    // 서비스워커 등록 (production only)
    if ('serviceWorker' in navigator && process.env.NODE_ENV === 'production') {
      navigator.serviceWorker.register('/sw.js', { scope: '/', updateViaCache: 'none' })
    }

    // Android Chrome 설치 프롬프트 캡처
    const handler = (e: Event) => {
      e.preventDefault()
      setInstallPrompt(e)
    }
    window.addEventListener('beforeinstallprompt', handler)
    return () => window.removeEventListener('beforeinstallprompt', handler)
  }, [])

  const handleInstall = async () => {
    if (!installPrompt) return
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (installPrompt as any).prompt()
    setInstallPrompt(null)
  }

  if (isStandalone || !installPrompt) return null

  return (
    <button
      onClick={handleInstall}
      className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] font-medium transition-all"
      style={{
        background: 'var(--accent-dim)',
        border: '1px solid var(--accent)',
        color: 'var(--accent-light)',
      }}
      title="홈 화면에 추가"
    >
      <Download size={13} />
      <span className="hidden sm:inline">앱 설치</span>
    </button>
  )
}
