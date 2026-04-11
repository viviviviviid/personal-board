'use client'
import { useState, useCallback } from 'react'

export function useUpgradeModal() {
  const [open, setOpen] = useState(false)
  const [reason, setReason] = useState<string | undefined>()

  const triggerUpgrade = useCallback((msg?: string) => {
    setReason(msg)
    setOpen(true)
  }, [])

  const closeUpgrade = useCallback(() => setOpen(false), [])

  return { upgradeOpen: open, upgradeReason: reason, triggerUpgrade, closeUpgrade }
}

export function isUpgradeRequired(status: number): boolean {
  return status === 402
}
