'use client'

import { useState, useEffect } from 'react'
import { usePathname } from 'next/navigation'
import SettingsModal from './SettingsModal'

export default function NativeAppBridge() {
  const pathname = usePathname()
  const [isNativeApp, setIsNativeApp] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)

  useEffect(() => {
    setIsNativeApp(navigator.userAgent.includes('PersonalBoardApp'))
  }, [])

  useEffect(() => {
    if (!isNativeApp) return

    const handleOpenSettings = () => setSettingsOpen(true)
    const handleBackPressed = () => {
      // 백버튼 처리 — Context에서 우선순위대로 처리됨
      window.dispatchEvent(new Event('personalboard:backPressed'))
    }

    window.addEventListener('personalboard:openSettings', handleOpenSettings)
    window.addEventListener('personalboard:backPressed', handleBackPressed)

    return () => {
      window.removeEventListener('personalboard:openSettings', handleOpenSettings)
      window.removeEventListener('personalboard:backPressed', handleBackPressed)
    }
  }, [isNativeApp])

  useEffect(() => {
    setSettingsOpen(false)
  }, [pathname])

  const handleClose = () => {
    setSettingsOpen(false)
    if (isNativeApp && (window as any).flutter_inappwebview) {
      ;(window as any).flutter_inappwebview.callHandler('personalBoardBridge', { action: 'settingsClosed' })
    }
  }

  if (!isNativeApp) return null

  return <SettingsModal isOpen={settingsOpen} onClose={handleClose} />
}
