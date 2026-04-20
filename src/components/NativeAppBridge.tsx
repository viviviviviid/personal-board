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
    const handler = () => setSettingsOpen(true)
    window.addEventListener('personalboard:openSettings', handler)
    return () => window.removeEventListener('personalboard:openSettings', handler)
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
