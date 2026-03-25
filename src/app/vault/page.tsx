'use client'
import { useState, useEffect, useRef, useCallback } from 'react'
import {
  Lock, Eye, EyeOff, Copy, Plus, Pin, Trash2,
  ChevronLeft, Check, Shield, Search, X, AlertTriangle,
} from 'lucide-react'
import { deriveKey, encryptText, decryptText, randomSaltHex } from '@/lib/vaultCrypto'
import { VaultRow, VaultContent, newRowId, parseContent, serializeContent } from '@/lib/vaultContent'

interface Credential {
  id: string
  name: string
  type: string
  encryptedValue: string
  iv: string
  description: string | null
  pinned: boolean
  createdAt: string
  updatedAt: string
}

type Status = 'loading' | 'setup' | 'locked' | 'unlocked'

function formatDate(iso: string): string {
  const d = new Date(iso)
  const now = new Date()
  const diff = now.getTime() - d.getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return '방금'
  if (mins < 60) return `${mins}분 전`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}시간 전`
  const days = Math.floor(hours / 24)
  if (days < 7) return `${days}일 전`
  return d.toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' })
}

export default function VaultPage() {
  const [status, setStatus] = useState<Status>('loading')
  const [cryptoKey, setCryptoKey] = useState<CryptoKey | null>(null)
  const [saltHex, setSaltHex] = useState('')
  const [verifierJson, setVerifierJson] = useState('')

  // 잠금 화면 폼
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [passwordError, setPasswordError] = useState('')
  const [authLoading, setAuthLoading] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)

  // 자격증명 목록
  const [credentials, setCredentials] = useState<Credential[]>([])
  const [selected, setSelected] = useState<Credential | null>(null)
  const [showEditor, setShowEditor] = useState(false)
  const [saving, setSaving] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [query, setQuery] = useState('')

  // 에디터 draft
  const [draftName, setDraftName] = useState('')
  const [draftDescription, setDraftDescription] = useState('')
  const [draftRows, setDraftRows] = useState<VaultRow[]>([])
  const [draftNote, setDraftNote] = useState('')

  // 행별 보이기 상태
  const [revealedRows, setRevealedRows] = useState<Set<string>>(new Set())
  const [copiedRowId, setCopiedRowId] = useState<string | null>(null)

  const saveTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  // ── 초기 로드 ──
  useEffect(() => {
    fetch('/api/vault/config')
      .then(r => r.json())
      .then(data => {
        if (data.exists) {
          setSaltHex(data.salt)
          setVerifierJson(data.verifier)
          setStatus('locked')
        } else {
          setStatus('setup')
        }
      })
      .catch(() => setStatus('setup'))
  }, [])

  const fetchCredentials = useCallback(async () => {
    const res = await fetch('/api/vault/credentials')
    if (res.ok) setCredentials(await res.json())
  }, [])

  // ── 설정 ──
  const handleSetup = async (e: React.FormEvent) => {
    e.preventDefault()
    if (password.length < 8) { setPasswordError('비밀번호는 최소 8자 이상이어야 합니다'); return }
    if (password !== confirmPassword) { setPasswordError('비밀번호가 일치하지 않습니다'); return }
    setPasswordError('')
    setAuthLoading(true)
    try {
      const salt = randomSaltHex()
      const key = await deriveKey(password, salt)
      const { iv, ciphertext } = await encryptText(key, 'vault-verified')
      const verifier = JSON.stringify({ iv, ciphertext })
      const res = await fetch('/api/vault/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ salt, verifier }),
      })
      if (res.ok) {
        setSaltHex(salt)
        setVerifierJson(verifier)
        setCryptoKey(key)
        await fetchCredentials()
        setStatus('unlocked')
        setPassword('')
        setConfirmPassword('')
      } else {
        setPasswordError('설정 중 오류가 발생했습니다')
      }
    } catch {
      setPasswordError('암호화 오류가 발생했습니다')
    } finally {
      setAuthLoading(false)
    }
  }

  // ── 잠금 해제 ──
  const handleUnlock = async (e: React.FormEvent) => {
    e.preventDefault()
    setPasswordError('')
    setAuthLoading(true)
    try {
      const key = await deriveKey(password, saltHex)
      const { iv, ciphertext } = JSON.parse(verifierJson)
      const verified = await decryptText(key, iv, ciphertext)
      if (verified === 'vault-verified') {
        setCryptoKey(key)
        await fetchCredentials()
        setStatus('unlocked')
        setPassword('')
      } else {
        setPasswordError('비밀번호가 올바르지 않습니다')
      }
    } catch {
      setPasswordError('비밀번호가 올바르지 않습니다')
    } finally {
      setAuthLoading(false)
    }
  }

  const handleLock = () => {
    setCryptoKey(null)
    setCredentials([])
    setSelected(null)
    setShowEditor(false)
    setDraftRows([])
    setDraftNote('')
    setRevealedRows(new Set())
    setStatus('locked')
  }

  // ── 자격증명 열기 ──
  const openCredential = useCallback(async (cred: Credential, key: CryptoKey) => {
    clearTimeout(saveTimer.current)
    setSelected(cred)
    setRevealedRows(new Set())
    setCopiedRowId(null)
    try {
      const plain = await decryptText(key, cred.iv, cred.encryptedValue)
      const content = parseContent(plain)
      setDraftName(cred.name)
      setDraftDescription(cred.description ?? '')
      setDraftRows(content.rows)
      setDraftNote(content.note)
    } catch {
      setDraftName(cred.name)
      setDraftDescription(cred.description ?? '')
      setDraftRows([])
      setDraftNote('')
    }
    setShowEditor(true)
  }, [])

  // ── 새 자격증명 ──
  const newCredential = useCallback(async () => {
    if (!cryptoKey) return
    const initialContent: VaultContent = { rows: [{ id: newRowId(), key: '', value: '' }], note: '' }
    const { iv, ciphertext } = await encryptText(cryptoKey, serializeContent(initialContent))
    const res = await fetch('/api/vault/credentials', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: '새 항목', type: 'note', encryptedValue: ciphertext, iv }),
    })
    if (res.ok) {
      const cred = await res.json()
      setCredentials(prev => [cred, ...prev])
      await openCredential(cred, cryptoKey)
    }
  }, [cryptoKey, openCredential])

  // ── 자동 저장 ──
  const scheduleSave = useCallback((
    name: string,
    description: string,
    rows: VaultRow[],
    note: string,
  ) => {
    if (!cryptoKey || !selected) return
    clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(async () => {
      if (!cryptoKey || !selected) return
      setSaving(true)
      try {
        const content: VaultContent = { rows, note }
        const { iv, ciphertext } = await encryptText(cryptoKey, serializeContent(content))
        const res = await fetch(`/api/vault/credentials/${selected.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name, description: description || null, encryptedValue: ciphertext, iv }),
        })
        if (res.ok) {
          const updated = await res.json()
          setSelected(updated)
          setCredentials(prev => {
            const list = prev.map(c => c.id === updated.id ? updated : c)
            return [...list.filter(c => c.pinned), ...list.filter(c => !c.pinned)]
          })
        }
      } finally {
        setSaving(false)
      }
    }, 1500)
  }, [cryptoKey, selected])

  const updateName = (v: string) => {
    setDraftName(v)
    scheduleSave(v, draftDescription, draftRows, draftNote)
  }
  const updateDescription = (v: string) => {
    setDraftDescription(v)
    scheduleSave(draftName, v, draftRows, draftNote)
  }
  const updateNote = (v: string) => {
    setDraftNote(v)
    scheduleSave(draftName, draftDescription, draftRows, v)
  }

  const updateRow = (id: string, field: 'key' | 'value', v: string) => {
    const next = draftRows.map(r => r.id === id ? { ...r, [field]: v } : r)
    setDraftRows(next)
    scheduleSave(draftName, draftDescription, next, draftNote)
  }

  const addRow = () => {
    const next = [...draftRows, { id: newRowId(), key: '', value: '' }]
    setDraftRows(next)
    scheduleSave(draftName, draftDescription, next, draftNote)
  }

  const removeRow = (id: string) => {
    const next = draftRows.filter(r => r.id !== id)
    setDraftRows(next)
    setRevealedRows(prev => { const s = new Set(prev); s.delete(id); return s })
    scheduleSave(draftName, draftDescription, next, draftNote)
  }

  const toggleReveal = (id: string) => {
    setRevealedRows(prev => {
      const s = new Set(prev)
      s.has(id) ? s.delete(id) : s.add(id)
      return s
    })
  }

  const toggleRevealAll = () => {
    if (revealedRows.size === draftRows.length && draftRows.length > 0) {
      setRevealedRows(new Set())
    } else {
      setRevealedRows(new Set(draftRows.map(r => r.id)))
    }
  }

  const copyRow = async (row: VaultRow) => {
    await navigator.clipboard.writeText(row.value)
    setCopiedRowId(row.id)
    setTimeout(() => setCopiedRowId(null), 2000)
  }

  const togglePin = async (cred: Credential, e: React.MouseEvent) => {
    e.stopPropagation()
    const res = await fetch(`/api/vault/credentials/${cred.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pinned: !cred.pinned }),
    })
    if (res.ok) {
      const updated = await res.json()
      setCredentials(prev => {
        const list = prev.map(c => c.id === updated.id ? updated : c)
        return [...list.filter(c => c.pinned), ...list.filter(c => !c.pinned)]
      })
      if (selected?.id === cred.id) setSelected(updated)
    }
  }

  const deleteCredential = async () => {
    if (!selected) return
    const res = await fetch(`/api/vault/credentials/${selected.id}`, { method: 'DELETE' })
    if (res.ok) {
      setCredentials(prev => prev.filter(c => c.id !== selected.id))
      setSelected(null)
      setShowEditor(false)
      setShowDeleteConfirm(false)
    }
  }

  const filteredCredentials = credentials.filter(c =>
    !query || c.name.toLowerCase().includes(query.toLowerCase()) ||
    (c.description ?? '').toLowerCase().includes(query.toLowerCase())
  )

  const allRevealed = draftRows.length > 0 && revealedRows.size === draftRows.length

  // ─── Loading ───
  if (status === 'loading') {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100dvh', background: 'var(--bg-base)' }}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
          <div style={{ width: 40, height: 40, borderRadius: 10, background: 'var(--bg-card)', border: '1px solid var(--border-dim)', animation: 'pulse 1.5s infinite' }} />
          <div style={{ width: 120, height: 12, borderRadius: 6, background: 'var(--bg-card)', border: '1px solid var(--border-dim)', animation: 'pulse 1.5s infinite' }} />
        </div>
      </div>
    )
  }

  // ─── Setup ───
  if (status === 'setup') {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100dvh', background: 'var(--bg-base)', padding: 20 }}>
        <div style={{
          width: '100%', maxWidth: 380,
          background: 'var(--bg-surface)', border: '1px solid var(--border)',
          borderRadius: 20, padding: 32, display: 'flex', flexDirection: 'column', gap: 20,
        }}>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
            <div style={{
              width: 56, height: 56, borderRadius: 16,
              background: 'var(--accent-dim)', border: '1px solid var(--accent)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <Shield size={26} style={{ color: 'var(--accent-light)' }} />
            </div>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-bright)' }}>금고 설정</div>
              <div style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 4 }}>
                마스터 비밀번호로 모든 자격증명을 암호화합니다.
              </div>
            </div>
          </div>

          {/* 경고 박스 */}
          <div style={{
            display: 'flex', gap: 10, padding: '12px 14px',
            borderRadius: 12, border: '1px solid #f59e0b',
            background: 'rgba(245,158,11,0.08)',
          }}>
            <AlertTriangle size={16} style={{ color: '#f59e0b', flexShrink: 0, marginTop: 1 }} />
            <div style={{ fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.6 }}>
              <div style={{ fontWeight: 600, color: '#f59e0b', marginBottom: 4 }}>비밀번호를 절대 잊지 마세요</div>
              <ul style={{ margin: 0, paddingLeft: 14, display: 'flex', flexDirection: 'column', gap: 2 }}>
                <li>마스터 비밀번호는 <strong style={{ color: 'var(--text)' }}>서버에 저장되지 않습니다</strong></li>
                <li>분실 시 저장된 모든 자격증명을 <strong style={{ color: 'var(--text)' }}>영구적으로 복구할 수 없습니다</strong></li>
                <li>반드시 안전한 곳에 별도로 기록해 두세요</li>
              </ul>
            </div>
          </div>

          <form onSubmit={handleSetup} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ position: 'relative' }}>
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="마스터 비밀번호 (최소 8자)"
                autoFocus
                style={{
                  width: '100%', padding: '10px 40px 10px 14px', borderRadius: 10,
                  border: '1px solid var(--border)', background: 'var(--bg-input)',
                  color: 'var(--text)', fontSize: 14, outline: 'none', boxSizing: 'border-box',
                }}
                onFocus={e => { e.currentTarget.style.borderColor = 'var(--accent)' }}
                onBlur={e => { e.currentTarget.style.borderColor = 'var(--border)' }}
              />
              <button type="button" onClick={() => setShowPassword(p => !p)}
                style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-dim)', padding: 0, display: 'flex' }}>
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
            <div style={{ position: 'relative' }}>
              <input
                type={showConfirm ? 'text' : 'password'}
                value={confirmPassword}
                onChange={e => setConfirmPassword(e.target.value)}
                placeholder="비밀번호 확인"
                style={{
                  width: '100%', padding: '10px 40px 10px 14px', borderRadius: 10,
                  border: '1px solid var(--border)', background: 'var(--bg-input)',
                  color: 'var(--text)', fontSize: 14, outline: 'none', boxSizing: 'border-box',
                }}
                onFocus={e => { e.currentTarget.style.borderColor = 'var(--accent)' }}
                onBlur={e => { e.currentTarget.style.borderColor = 'var(--border)' }}
              />
              <button type="button" onClick={() => setShowConfirm(p => !p)}
                style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-dim)', padding: 0, display: 'flex' }}>
                {showConfirm ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>

            {passwordError && (
              <div style={{ fontSize: 12, color: 'var(--danger, #ef4444)', padding: '6px 10px', borderRadius: 8, background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)' }}>
                {passwordError}
              </div>
            )}

            <button type="submit" disabled={authLoading || !password}
              style={{
                padding: '11px', borderRadius: 10, border: 'none', cursor: authLoading ? 'not-allowed' : 'pointer',
                background: 'var(--accent)', color: '#fff', fontSize: 14, fontWeight: 600,
                opacity: authLoading || !password ? 0.6 : 1,
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              }}
            >
              <Shield size={15} />
              {authLoading ? '설정 중...' : '금고 생성'}
            </button>
          </form>
        </div>
      </div>
    )
  }

  // ─── Locked ───
  if (status === 'locked') {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100dvh', background: 'var(--bg-base)', padding: 20 }}>
        <div style={{
          width: '100%', maxWidth: 360,
          background: 'var(--bg-surface)', border: '1px solid var(--border)',
          borderRadius: 20, padding: 32, display: 'flex', flexDirection: 'column', gap: 24,
        }}>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
            <div style={{
              width: 56, height: 56, borderRadius: 16,
              background: 'var(--bg-card)', border: '1px solid var(--border)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <Lock size={26} style={{ color: 'var(--text-muted)' }} />
            </div>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-bright)' }}>금고 잠금됨</div>
              <div style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 4 }}>마스터 비밀번호를 입력해 잠금 해제하세요</div>
            </div>
          </div>

          <form onSubmit={handleUnlock} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ position: 'relative' }}>
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="마스터 비밀번호"
                autoFocus
                style={{
                  width: '100%', padding: '10px 40px 10px 14px', borderRadius: 10,
                  border: '1px solid var(--border)', background: 'var(--bg-input)',
                  color: 'var(--text)', fontSize: 14, outline: 'none', boxSizing: 'border-box',
                }}
                onFocus={e => { e.currentTarget.style.borderColor = 'var(--accent)' }}
                onBlur={e => { e.currentTarget.style.borderColor = 'var(--border)' }}
              />
              <button type="button" onClick={() => setShowPassword(p => !p)}
                style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-dim)', padding: 0, display: 'flex' }}>
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>

            {passwordError && (
              <div style={{ fontSize: 12, color: 'var(--danger, #ef4444)', padding: '6px 10px', borderRadius: 8, background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)' }}>
                {passwordError}
              </div>
            )}

            <button type="submit" disabled={authLoading || !password}
              style={{
                padding: '11px', borderRadius: 10, border: 'none', cursor: authLoading ? 'not-allowed' : 'pointer',
                background: 'var(--accent)', color: '#fff', fontSize: 14, fontWeight: 600,
                opacity: authLoading || !password ? 0.6 : 1,
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              }}
            >
              <Lock size={15} />
              {authLoading ? '잠금 해제 중...' : '잠금 해제'}
            </button>
          </form>
        </div>
      </div>
    )
  }

  // ─── Unlocked ───
  return (
    <div style={{ display: 'flex', height: '100dvh', overflow: 'hidden', background: 'var(--bg-base)' }}>

      {/* ── 목록 패널 ── */}
      <div
        style={{
          minWidth: 0, flexShrink: 0,
          display: showEditor ? 'none' : 'flex',
          flexDirection: 'column',
          borderRight: '1px solid var(--border-dim)',
          background: 'var(--bg-surface)',
          width: '100%',
        }}
        className="md:!flex md:!w-72 lg:!w-80"
      >
        <div style={{ padding: '16px 12px 8px', flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
              <Shield size={16} style={{ color: 'var(--accent-light)' }} />
              <h1 style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-bright)', margin: 0 }}>금고</h1>
            </div>
            <div style={{ display: 'flex', gap: 6 }}>
              <button
                onClick={handleLock}
                style={{
                  display: 'flex', alignItems: 'center', gap: 4, padding: '5px 10px',
                  borderRadius: 8, border: '1px solid var(--border-dim)', cursor: 'pointer',
                  background: 'var(--bg-card)', color: 'var(--text-dim)', fontSize: 12,
                }}
                onMouseEnter={e => { e.currentTarget.style.color = 'var(--text)'; e.currentTarget.style.borderColor = 'var(--border)' }}
                onMouseLeave={e => { e.currentTarget.style.color = 'var(--text-dim)'; e.currentTarget.style.borderColor = 'var(--border-dim)' }}
              >
                <Lock size={12} />잠금
              </button>
              <button
                onClick={newCredential}
                style={{
                  display: 'flex', alignItems: 'center', gap: 4, padding: '5px 10px',
                  borderRadius: 8, border: 'none', cursor: 'pointer',
                  background: 'var(--accent)', color: '#fff', fontSize: 12, fontWeight: 600,
                }}
              >
                <Plus size={13} />추가
              </button>
            </div>
          </div>

          <div style={{ position: 'relative' }}>
            <Search size={13} style={{ position: 'absolute', left: 9, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-dim)', pointerEvents: 'none' }} />
            <input
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="검색..."
              style={{
                width: '100%', padding: '7px 7px 7px 28px', borderRadius: 8, border: '1px solid var(--border-dim)',
                background: 'var(--bg-input)', color: 'var(--text)', fontSize: 12, outline: 'none', boxSizing: 'border-box',
              }}
            />
            {query && (
              <button onClick={() => setQuery('')} style={{ position: 'absolute', right: 7, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-dim)', padding: 0 }}>
                <X size={12} />
              </button>
            )}
          </div>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: '4px 8px 80px' }}>
          {filteredCredentials.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px 16px', color: 'var(--text-dim)', fontSize: 13 }}>
              {query ? '검색 결과 없음' : '항목이 없습니다'}
            </div>
          ) : filteredCredentials.map(cred => {
            const isActive = selected?.id === cred.id
            return (
              <div
                key={cred.id}
                onClick={() => openCredential(cred, cryptoKey!)}
                style={{
                  padding: '10px', borderRadius: 10, marginBottom: 3, cursor: 'pointer',
                  border: '1px solid', borderColor: isActive ? 'var(--accent)' : 'transparent',
                  background: isActive ? 'var(--bg-hover)' : 'transparent', position: 'relative',
                }}
                onMouseEnter={e => { if (!isActive) e.currentTarget.style.background = 'var(--bg-card)' }}
                onMouseLeave={e => { if (!isActive) e.currentTarget.style.background = 'transparent' }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div style={{
                    width: 32, height: 32, borderRadius: 9, flexShrink: 0,
                    background: 'var(--accent-dim)', border: '1px solid var(--accent)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 14,
                  }}>
                    🔒
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-bright)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {cred.name}
                    </div>
                    {cred.description && (
                      <div style={{ fontSize: 11, color: 'var(--text-dim)', marginTop: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {cred.description}
                      </div>
                    )}
                    <div style={{ fontSize: 10, color: 'var(--text-dim)', marginTop: 2 }}>{formatDate(cred.updatedAt)}</div>
                  </div>
                  {cred.pinned && <Pin size={11} style={{ color: 'var(--accent-light)', flexShrink: 0 }} />}
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* ── 에디터 패널 ── */}
      <div
        style={{
          flex: 1, display: showEditor ? 'flex' : 'none', flexDirection: 'column',
          minWidth: 0, background: 'var(--bg-base)',
        }}
        className="md:!flex"
      >
        {selected ? (
          <>
            {/* 헤더 */}
            <div style={{
              display: 'flex', alignItems: 'center', gap: 8, padding: '12px 16px',
              borderBottom: '1px solid var(--border-dim)', flexShrink: 0, background: 'var(--bg-surface)',
            }}>
              <button onClick={() => setShowEditor(false)} className="md:hidden"
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 4, display: 'flex' }}>
                <ChevronLeft size={18} />
              </button>
              <input
                value={draftName}
                onChange={e => updateName(e.target.value)}
                placeholder="항목 이름"
                style={{ flex: 1, background: 'none', border: 'none', outline: 'none', fontSize: 15, fontWeight: 600, color: 'var(--text-bright)', minWidth: 0 }}
              />
              <span style={{ fontSize: 11, color: 'var(--text-dim)', flexShrink: 0 }}>
                {saving ? '저장 중...' : '자동 저장'}
              </span>
              <button onClick={e => togglePin(selected, e)} title={selected.pinned ? '고정 해제' : '고정'}
                style={{
                  background: selected.pinned ? 'var(--accent-dim)' : 'var(--bg-card)',
                  border: '1px solid var(--border-dim)', borderRadius: 7, padding: '5px 7px',
                  cursor: 'pointer', display: 'flex', color: selected.pinned ? 'var(--accent-light)' : 'var(--text-dim)',
                }}>
                <Pin size={13} />
              </button>
              <button onClick={() => setShowDeleteConfirm(true)}
                style={{ background: 'none', border: '1px solid var(--border-dim)', borderRadius: 7, padding: '5px 7px', cursor: 'pointer', color: 'var(--text-dim)', display: 'flex' }}
                onMouseEnter={e => { e.currentTarget.style.color = 'var(--danger)'; e.currentTarget.style.borderColor = 'var(--danger)' }}
                onMouseLeave={e => { e.currentTarget.style.color = 'var(--text-dim)'; e.currentTarget.style.borderColor = 'var(--border-dim)' }}>
                <Trash2 size={13} />
              </button>
            </div>

            {/* 설명 (plaintext 힌트) */}
            <div style={{ padding: '8px 16px', borderBottom: '1px solid var(--border-dim)', background: 'var(--bg-surface)', flexShrink: 0 }}>
              <input
                value={draftDescription}
                onChange={e => updateDescription(e.target.value)}
                placeholder="간단한 설명 (목록에 표시됨, 암호화되지 않음)"
                style={{
                  width: '100%', background: 'none', border: 'none', outline: 'none',
                  fontSize: 12, color: 'var(--text-muted)',
                }}
              />
            </div>

            {/* 콘텐츠 */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '20px' }}>

              {/* 행 테이블 헤더 */}
              <div style={{ display: 'flex', alignItems: 'center', marginBottom: 8 }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', letterSpacing: '0.05em', textTransform: 'uppercase' }}>
                  항목
                </div>
                <div style={{ flex: 1 }} />
                {draftRows.length > 0 && (
                  <button
                    onClick={toggleRevealAll}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 4, padding: '3px 9px', borderRadius: 7,
                      border: '1px solid var(--border-dim)', background: 'var(--bg-card)',
                      color: 'var(--text-dim)', cursor: 'pointer', fontSize: 11,
                    }}
                    onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--border)' }}
                    onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border-dim)' }}
                  >
                    {allRevealed ? <EyeOff size={11} /> : <Eye size={11} />}
                    {allRevealed ? '모두 숨기기' : '모두 보기'}
                  </button>
                )}
              </div>

              {/* 행 목록 */}
              <div style={{ borderRadius: 12, border: '1px solid var(--border-dim)', overflow: 'hidden', marginBottom: 10 }}>
                {draftRows.length === 0 ? (
                  <div style={{ padding: '20px', textAlign: 'center', color: 'var(--text-dim)', fontSize: 13 }}>
                    아래 버튼으로 항목을 추가하세요
                  </div>
                ) : draftRows.map((row, idx) => {
                  const revealed = revealedRows.has(row.id)
                  const isCopied = copiedRowId === row.id
                  return (
                    <div
                      key={row.id}
                      style={{
                        display: 'grid',
                        gridTemplateColumns: '140px 1fr auto',
                        alignItems: 'center',
                        borderTop: idx === 0 ? 'none' : '1px solid var(--border-dim)',
                        background: 'var(--bg-surface)',
                      }}
                    >
                      {/* 키 */}
                      <input
                        value={row.key}
                        onChange={e => updateRow(row.id, 'key', e.target.value)}
                        placeholder="항목 이름"
                        style={{
                          padding: '10px 12px', background: 'none', border: 'none',
                          borderRight: '1px solid var(--border-dim)', outline: 'none',
                          fontSize: 13, color: 'var(--text-muted)', fontWeight: 500,
                        }}
                      />
                      {/* 값 */}
                      <input
                        type={revealed ? 'text' : 'password'}
                        value={row.value}
                        onChange={e => updateRow(row.id, 'value', e.target.value)}
                        placeholder="값"
                        style={{
                          padding: '10px 12px', background: 'none', border: 'none', outline: 'none',
                          fontSize: 13, color: 'var(--text)', fontFamily: revealed ? 'inherit' : 'monospace',
                          minWidth: 0,
                        }}
                      />
                      {/* 액션 */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: 2, paddingRight: 8, flexShrink: 0 }}>
                        <button onClick={() => toggleReveal(row.id)} title={revealed ? '숨기기' : '보기'}
                          style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '5px 5px', borderRadius: 6, color: revealed ? 'var(--accent-light)' : 'var(--text-dim)', display: 'flex' }}
                          onMouseEnter={e => { e.currentTarget.style.background = 'var(--bg-hover)' }}
                          onMouseLeave={e => { e.currentTarget.style.background = 'none' }}
                        >
                          {revealed ? <EyeOff size={13} /> : <Eye size={13} />}
                        </button>
                        <button onClick={() => copyRow(row)} title="복사"
                          style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '5px 5px', borderRadius: 6, color: isCopied ? 'var(--accent-light)' : 'var(--text-dim)', display: 'flex' }}
                          onMouseEnter={e => { e.currentTarget.style.background = 'var(--bg-hover)' }}
                          onMouseLeave={e => { e.currentTarget.style.background = 'none' }}
                        >
                          {isCopied ? <Check size={13} /> : <Copy size={13} />}
                        </button>
                        <button onClick={() => removeRow(row.id)} title="삭제"
                          style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '5px 5px', borderRadius: 6, color: 'var(--text-dim)', display: 'flex' }}
                          onMouseEnter={e => { e.currentTarget.style.color = 'var(--danger)'; e.currentTarget.style.background = 'var(--bg-hover)' }}
                          onMouseLeave={e => { e.currentTarget.style.color = 'var(--text-dim)'; e.currentTarget.style.background = 'none' }}
                        >
                          <X size={13} />
                        </button>
                      </div>
                    </div>
                  )
                })}
              </div>

              {/* 행 추가 */}
              <button
                onClick={addRow}
                style={{
                  display: 'flex', alignItems: 'center', gap: 6, padding: '7px 12px',
                  borderRadius: 8, border: '1px dashed var(--border)', background: 'transparent',
                  color: 'var(--text-dim)', cursor: 'pointer', fontSize: 12, marginBottom: 24,
                }}
                onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--accent)'; e.currentTarget.style.color = 'var(--accent-light)' }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.color = 'var(--text-dim)' }}
              >
                <Plus size={13} />항목 추가
              </button>

              {/* 자유 메모 */}
              <div style={{ marginBottom: 8 }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', letterSpacing: '0.05em', textTransform: 'uppercase', marginBottom: 8 }}>
                  메모
                </div>
                <textarea
                  value={draftNote}
                  onChange={e => updateNote(e.target.value)}
                  placeholder="추가 메모 (선택)..."
                  rows={4}
                  style={{
                    width: '100%', padding: '12px', borderRadius: 10,
                    border: '1px solid var(--border-dim)', background: 'var(--bg-input)',
                    color: 'var(--text)', fontSize: 13, lineHeight: 1.7,
                    resize: 'vertical', outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box',
                  }}
                  onFocus={e => { e.currentTarget.style.borderColor = 'var(--accent)' }}
                  onBlur={e => { e.currentTarget.style.borderColor = 'var(--border-dim)' }}
                />
              </div>

              <div style={{ fontSize: 11, color: 'var(--text-dim)', marginTop: 8 }}>
                생성: {formatDate(selected.createdAt)} · 수정: {formatDate(selected.updatedAt)}
              </div>
            </div>
          </>
        ) : (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 14, color: 'var(--text-dim)' }}>
            <div style={{
              width: 56, height: 56, borderRadius: 16, background: 'var(--bg-card)',
              border: '1px solid var(--border-dim)', display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <Shield size={26} style={{ color: 'var(--accent-light)', opacity: 0.5 }} />
            </div>
            <div style={{ fontSize: 14, color: 'var(--text-muted)' }}>항목을 선택하거나 새로 추가하세요</div>
            <button onClick={newCredential}
              style={{
                padding: '8px 18px', borderRadius: 10, border: 'none', cursor: 'pointer',
                background: 'var(--accent)', color: '#fff', fontSize: 13, fontWeight: 600,
                display: 'flex', alignItems: 'center', gap: 6,
              }}
            >
              <Plus size={14} />새 항목
            </button>
          </div>
        )}
      </div>

      {/* 삭제 확인 모달 */}
      {showDeleteConfirm && (
        <div
          style={{ position: 'fixed', inset: 0, zIndex: 100, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}
          onClick={() => setShowDeleteConfirm(false)}
        >
          <div
            style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 14, padding: 24, maxWidth: 320, width: '100%' }}
            onClick={e => e.stopPropagation()}
          >
            <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-bright)', marginBottom: 8 }}>항목 삭제</div>
            <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 20 }}>
              &ldquo;{selected?.name}&rdquo;를 삭제합니다. 되돌릴 수 없습니다.
            </div>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button onClick={() => setShowDeleteConfirm(false)}
                style={{ padding: '7px 14px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg-card)', color: 'var(--text-muted)', cursor: 'pointer', fontSize: 13 }}>
                취소
              </button>
              <button onClick={deleteCredential}
                style={{ padding: '7px 14px', borderRadius: 8, border: 'none', background: 'var(--danger, #ef4444)', color: '#fff', cursor: 'pointer', fontSize: 13, fontWeight: 600 }}>
                삭제
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 모바일 FAB */}
      {!showEditor && (
        <button onClick={newCredential} className="md:hidden"
          style={{
            position: 'fixed', right: 20, bottom: 'calc(env(safe-area-inset-bottom) + 72px)',
            width: 52, height: 52, borderRadius: '50%', border: 'none', cursor: 'pointer',
            background: 'var(--accent)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 4px 16px rgba(139,92,246,0.4)',
          }}
        >
          <Plus size={22} />
        </button>
      )}
    </div>
  )
}
