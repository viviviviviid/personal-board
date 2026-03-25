'use client'

import { createContext, useContext, useState } from 'react'

interface VaultContextValue {
  cryptoKey: CryptoKey | null
  setCryptoKey: (key: CryptoKey | null) => void
}

const VaultContext = createContext<VaultContextValue | null>(null)

export function VaultProvider({ children }: { children: React.ReactNode }) {
  const [cryptoKey, setCryptoKey] = useState<CryptoKey | null>(null)
  return (
    <VaultContext.Provider value={{ cryptoKey, setCryptoKey }}>
      {children}
    </VaultContext.Provider>
  )
}

export function useVaultKey() {
  const ctx = useContext(VaultContext)
  if (!ctx) throw new Error('useVaultKey must be used within VaultProvider')
  return ctx
}
