'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { Pin, Plus, Search, Trash2, ChevronLeft, X, Tag, Calendar, Lock, Eye, EyeOff, Copy, Check, Shield } from 'lucide-react'
import NoteEditor from '@/components/NoteEditor'
import { parseTags, sanitizeTag, serializeTags, noteDisplayTitle, matchesSearch } from '@/lib/noteUtils'
import { deriveKey, encryptText, decryptText, randomSaltHex } from '@/lib/vaultCrypto'
import { VaultRow, VaultContent, newRowId, parseContent, serializeContent } from '@/lib/vaultContent'
import { useVaultKey } from '@/context/VaultContext'

interface Note {
  id: string
  title: string | null
  content: string
  tags: string | null
  date: string | null
  pinned: boolean
  createdAt: string
  updatedAt: string
}

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


export default function NotesPage() {

  // ── 탭 상태 ──
  const [activeTab, setActiveTab] = useState<'notes' | 'vault'>('notes')

  // ── 메모 상태 ──
  const [notes, setNotes] = useState<Note[]>([])
  const [selected, setSelected] = useState<Note | null>(null)
  const [draft, setDraft] = useState({ title: '', content: '', tags: '', date: '' })
  const [query, setQuery] = useState('')
  const [tagFilter, setTagFilter] = useState('')
  const [showEditor, setShowEditor] = useState(false)
  const [saving, setSaving] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [tagInput, setTagInput] = useState('')
  const [showTagInput, setShowTagInput] = useState(false)
  const saveTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const draftRef = useRef(draft)
  const selectedRef = useRef(selected)

  // ── 비밀 메모 (vault) 상태 ──
  const { cryptoKey, setCryptoKey } = useVaultKey()
  const [vaultStatus, setVaultStatus] = useState<'loading' | 'setup' | 'locked' | 'unlocked'>('loading')
  const [saltHex, setSaltHex] = useState('')
  const [verifierJson, setVerifierJson] = useState('')
  const [vaultPassword, setVaultPassword] = useState('')
  const [vaultPasswordError, setVaultPasswordError] = useState('')
  const [vaultAuthLoading, setVaultAuthLoading] = useState(false)
  const [showVaultPassword, setShowVaultPassword] = useState(false)
  const [credentials, setCredentials] = useState<Credential[]>([])
  const [selectedCred, setSelectedCred] = useState<Credential | null>(null)
  const [showCredEditor, setShowCredEditor] = useState(false)
  const [credSaving, setCredSaving] = useState(false)
  const [showCredDeleteConfirm, setShowCredDeleteConfirm] = useState(false)
  const [vaultQuery, setVaultQuery] = useState('')
  const [draftName, setDraftName] = useState('')
  const [draftDescription, setDraftDescription] = useState('')
  const [draftRows, setDraftRows] = useState<VaultRow[]>([])
  const [draftNote, setDraftNote] = useState('')
  const [revealedRows, setRevealedRows] = useState<Set<string>>(new Set())
  const [copiedRowId, setCopiedRowId] = useState<string | null>(null)
  const credSaveTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  // ── 메모 로직 ──
  const fetchNotes = useCallback(async (q?: string, tag?: string) => {
    const params = new URLSearchParams()
    if (q) params.set('q', q)
    if (tag) params.set('tag', tag)
    const res = await fetch(`/api/notes?${params}`)
    if (res.ok) setNotes(await res.json())
  }, [])

  useEffect(() => {
    fetchNotes()
  }, [fetchNotes])

  // 검색 debounce
  useEffect(() => {
    const t = setTimeout(() => fetchNotes(query, tagFilter), 300)
    return () => clearTimeout(t)
  }, [query, tagFilter, fetchNotes])

  // ref 동기화
  useEffect(() => { selectedRef.current = selected }, [selected])
  useEffect(() => { draftRef.current = draft }, [draft])

  // 빈 메모 정리 — ref 기반이라 어느 시점에서든 최신 값 사용 가능
  const maybePurgeEmpty = useCallback(() => {
    const cur = selectedRef.current
    const d = draftRef.current
    if (!cur) return
    if (!d.content.trim() && !d.title.trim()) {
      clearTimeout(saveTimer.current)
      fetch(`/api/notes/${cur.id}`, { method: 'DELETE' }).catch(() => {})
      setNotes(prev => prev.filter(n => n.id !== cur.id))
      setSelected(null)
      setShowEditor(false)
    }
  }, [])

  const openNote = (note: Note) => {
    maybePurgeEmpty()
    clearTimeout(saveTimer.current)
    setSelected(note)
    setDraft({
      title: note.title ?? '',
      content: note.content,
      tags: note.tags ?? '',
      date: note.date ?? '',
    })
    setShowEditor(true)
  }

  // 페이지 언마운트 시 빈 메모 정리
  useEffect(() => {
    return () => { maybePurgeEmpty() }
  }, [maybePurgeEmpty])

  const newNote = async () => {
    const res = await fetch('/api/notes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content: '' }),
    })
    if (res.ok) {
      const note = await res.json()
      setNotes(prev => [note, ...prev])
      openNote(note)
      const today = new Date().toISOString().slice(0, 10)
      handleDraftChange('date', today)
    }
  }

  const scheduleSave = (newDraft: typeof draft) => {
    clearTimeout(saveTimer.current)
    if (!newDraft.content.trim() && !newDraft.title.trim()) return
    saveTimer.current = setTimeout(async () => {
      if (!selected) return
      setSaving(true)
      const res = await fetch(`/api/notes/${selected.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: newDraft.title || null,
          content: newDraft.content,
          tags: newDraft.tags || null,
          date: newDraft.date || null,
        }),
      })
      if (res.ok) {
        const updated = await res.json()
        setSelected(updated)
        setNotes(prev => prev.map(n => n.id === updated.id ? updated : n))
      }
      setSaving(false)
    }, 1500)
  }

  const handleDraftChange = (field: keyof typeof draft, value: string) => {
    const next = { ...draft, [field]: value }
    draftRef.current = next
    setDraft(next)
    scheduleSave(next)
  }

  const togglePin = async (note: Note, e: React.MouseEvent) => {
    e.stopPropagation()
    const res = await fetch(`/api/notes/${note.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pinned: !note.pinned }),
    })
    if (res.ok) {
      const updated = await res.json()
      setNotes(prev => {
        const list = prev.map(n => n.id === updated.id ? updated : n)
        return [...list.filter(n => n.pinned), ...list.filter(n => !n.pinned)]
      })
      if (selected?.id === note.id) setSelected(updated)
    }
  }

  const deleteNote = async () => {
    if (!selected) return
    const res = await fetch(`/api/notes/${selected.id}`, { method: 'DELETE' })
    if (res.ok) {
      setNotes(prev => prev.filter(n => n.id !== selected.id))
      setSelected(null)
      setShowEditor(false)
      setShowDeleteConfirm(false)
    }
  }

  const addTag = () => {
    const tag = sanitizeTag(tagInput)
    if (!tag) { setTagInput(''); return }
    const existing = parseTags(draft.tags)
    if (existing.includes(tag)) { setTagInput(''); return }
    const next = { ...draft, tags: serializeTags([...existing, tag]) }
    setDraft(next)
    scheduleSave(next)
    setTagInput('')
    setShowTagInput(false)
  }

  const removeTag = (tag: string) => {
    const next = { ...draft, tags: serializeTags(parseTags(draft.tags).filter(t => t !== tag)) }
    setDraft(next)
    scheduleSave(next)
  }

  // 태그 필터는 로컬 필터링 (서버 검색과 별도)
  const displayedNotes = tagFilter
    ? notes.filter(n => parseTags(n.tags).includes(tagFilter))
    : notes
  const filteredByQuery = query
    ? displayedNotes.filter(n => matchesSearch(n, query))
    : displayedNotes

  const allTags = Array.from(new Set(notes.flatMap(n => parseTags(n.tags))))

  // ── 비밀 메모 로직 ──
  const fetchCredentials = useCallback(async () => {
    const res = await fetch('/api/vault/credentials')
    if (res.ok) setCredentials(await res.json())
  }, [])

  // vault 탭 활성화 시 config 로드
  useEffect(() => {
    if (activeTab !== 'vault') return
    if (vaultStatus !== 'loading') return
    fetch('/api/vault/config')
      .then(r => r.json())
      .then(async data => {
        if (!data.exists) { setVaultStatus('setup'); return }
        setSaltHex(data.salt)
        setVerifierJson(data.verifier)
        if (cryptoKey) {
          await fetchCredentials()
          setVaultStatus('unlocked')
        } else {
          setVaultStatus('locked')
        }
      })
      .catch(() => setVaultStatus('setup'))
  // cryptoKey 의도적으로 deps 제외 — 탭 전환 시 1회만 체크
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, vaultStatus, fetchCredentials])

  const handleVaultUnlock = async (e: React.FormEvent) => {
    e.preventDefault()
    setVaultPasswordError('')
    setVaultAuthLoading(true)
    try {
      const key = await deriveKey(vaultPassword, saltHex)
      const { iv, ciphertext } = JSON.parse(verifierJson)
      const verified = await decryptText(key, iv, ciphertext)
      if (verified === 'vault-verified') {
        setCryptoKey(key)
        await fetchCredentials()
        setVaultStatus('unlocked')
        setVaultPassword('')
      } else {
        setVaultPasswordError('비밀번호가 올바르지 않습니다')
      }
    } catch {
      setVaultPasswordError('비밀번호가 올바르지 않습니다')
    } finally {
      setVaultAuthLoading(false)
    }
  }

  const openCredential = useCallback(async (cred: Credential, key: CryptoKey) => {
    clearTimeout(credSaveTimer.current)
    setSelectedCred(cred)
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
    setShowCredEditor(true)
  }, [])

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

  const scheduleCredSave = useCallback((
    name: string,
    description: string,
    rows: VaultRow[],
    note: string,
  ) => {
    if (!cryptoKey || !selectedCred) return
    clearTimeout(credSaveTimer.current)
    credSaveTimer.current = setTimeout(async () => {
      if (!cryptoKey || !selectedCred) return
      setCredSaving(true)
      try {
        const content: VaultContent = { rows, note }
        const { iv, ciphertext } = await encryptText(cryptoKey, serializeContent(content))
        const res = await fetch(`/api/vault/credentials/${selectedCred.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name, description: description || null, encryptedValue: ciphertext, iv }),
        })
        if (res.ok) {
          const updated = await res.json()
          setSelectedCred(updated)
          setCredentials(prev => {
            const list = prev.map(c => c.id === updated.id ? updated : c)
            return [...list.filter(c => c.pinned), ...list.filter(c => !c.pinned)]
          })
        }
      } finally {
        setCredSaving(false)
      }
    }, 1500)
  }, [cryptoKey, selectedCred])

  const updateCredName = (v: string) => {
    setDraftName(v)
    scheduleCredSave(v, draftDescription, draftRows, draftNote)
  }
  const updateCredDescription = (v: string) => {
    setDraftDescription(v)
    scheduleCredSave(draftName, v, draftRows, draftNote)
  }
  const updateCredNote = (v: string) => {
    setDraftNote(v)
    scheduleCredSave(draftName, draftDescription, draftRows, v)
  }

  const updateRow = (id: string, field: 'key' | 'value', v: string) => {
    const next = draftRows.map(r => r.id === id ? { ...r, [field]: v } : r)
    setDraftRows(next)
    scheduleCredSave(draftName, draftDescription, next, draftNote)
  }

  const addRow = () => {
    const next = [...draftRows, { id: newRowId(), key: '', value: '' }]
    setDraftRows(next)
    scheduleCredSave(draftName, draftDescription, next, draftNote)
  }

  const removeRow = (id: string) => {
    const next = draftRows.filter(r => r.id !== id)
    setDraftRows(next)
    setRevealedRows(prev => { const s = new Set(prev); s.delete(id); return s })
    scheduleCredSave(draftName, draftDescription, next, draftNote)
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

  const toggleCredPin = async (cred: Credential, e: React.MouseEvent) => {
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
      if (selectedCred?.id === cred.id) setSelectedCred(updated)
    }
  }

  const deleteCredential = async () => {
    if (!selectedCred) return
    const res = await fetch(`/api/vault/credentials/${selectedCred.id}`, { method: 'DELETE' })
    if (res.ok) {
      setCredentials(prev => prev.filter(c => c.id !== selectedCred.id))
      setSelectedCred(null)
      setShowCredEditor(false)
      setShowCredDeleteConfirm(false)
    }
  }

  const filteredCredentials = credentials.filter(c =>
    !vaultQuery || c.name.toLowerCase().includes(vaultQuery.toLowerCase()) ||
    (c.description ?? '').toLowerCase().includes(vaultQuery.toLowerCase())
  )

  const allRevealed = draftRows.length > 0 && revealedRows.size === draftRows.length

  // 에디터 닫기 — 내용 없으면 자동 삭제
  const closeEditor = useCallback(() => {
    maybePurgeEmpty()
    setSelected(null)
    setShowEditor(false)
  }, [maybePurgeEmpty])

  // 탭 전환 시 에디터 닫기
  const handleTabChange = (tab: 'notes' | 'vault') => {
    if (tab !== activeTab && activeTab === 'notes') closeEditor()
    setActiveTab(tab)
    setShowCredEditor(false)
    setSelectedCred(null)
  }

  // 현재 탭의 showEditor 상태
  const isEditorShown = activeTab === 'notes' ? showEditor : showCredEditor

  return (
    <div style={{ display: 'flex', height: '100%', overflow: 'hidden', background: 'var(--bg-base)' }}>

      {/* ── 목록 패널 ── */}
      <div
        style={{
          minWidth: 0,
          flexShrink: 0,
          display: isEditorShown ? 'none' : 'flex',
          flexDirection: 'column',
          borderRight: '1px solid var(--border-dim)',
          background: 'var(--bg-surface)',
          width: '100%',
        }}
        className="md:!flex md:!w-72 lg:!w-80"
      >
        {/* 목록 헤더 */}
        <div style={{ padding: '16px 12px 8px', flexShrink: 0 }}>
          {/* 탭 */}
          <div style={{ display: 'flex', gap: 6, marginBottom: 10 }}>
            <button
              onClick={() => handleTabChange('notes')}
              style={{
                padding: '4px 12px', borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: 'pointer', border: '1px solid',
                background: activeTab === 'notes' ? 'var(--accent-dim)' : 'var(--bg-card)',
                borderColor: activeTab === 'notes' ? 'var(--accent)' : 'var(--border-dim)',
                color: activeTab === 'notes' ? 'var(--accent-light)' : 'var(--text-muted)',
              }}
            >
              메모
            </button>
            <button
              onClick={() => handleTabChange('vault')}
              style={{
                padding: '4px 12px', borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: 'pointer', border: '1px solid',
                background: activeTab === 'vault' ? 'var(--accent-dim)' : 'var(--bg-card)',
                borderColor: activeTab === 'vault' ? 'var(--accent)' : 'var(--border-dim)',
                color: activeTab === 'vault' ? 'var(--accent-light)' : 'var(--text-muted)',
                display: 'flex', alignItems: 'center', gap: 4,
              }}
            >
              <Lock size={11} />비밀 메모
            </button>
          </div>

          {activeTab === 'notes' && (
            <>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                <h1 style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-bright)', margin: 0 }}>메모</h1>
                <button
                  onClick={newNote}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 4,
                    padding: '5px 10px', borderRadius: 8, border: 'none', cursor: 'pointer',
                    background: 'var(--accent)', color: '#fff', fontSize: 12, fontWeight: 600,
                  }}
                >
                  <Plus size={13} />새 메모
                </button>
              </div>

              {/* 검색 */}
              <div style={{ position: 'relative', marginBottom: 8 }}>
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

              {/* 태그 필터 */}
              {allTags.length > 0 && (
                <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                  {allTags.map(tag => (
                    <button
                      key={tag}
                      onClick={() => setTagFilter(prev => prev === tag ? '' : tag)}
                      style={{
                        padding: '2px 8px', borderRadius: 12, fontSize: 11, cursor: 'pointer', border: '1px solid',
                        background: tagFilter === tag ? 'var(--accent-dim)' : 'var(--bg-card)',
                        borderColor: tagFilter === tag ? 'var(--accent)' : 'var(--border-dim)',
                        color: tagFilter === tag ? 'var(--accent-light)' : 'var(--text-muted)',
                      }}
                    >
                      {tag}
                    </button>
                  ))}
                </div>
              )}
            </>
          )}

          {activeTab === 'vault' && vaultStatus === 'unlocked' && (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <Shield size={14} style={{ color: 'var(--accent-light)' }} />
                <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-bright)' }}>비밀 메모</span>
              </div>
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
          )}

          {activeTab === 'vault' && vaultStatus === 'unlocked' && (
            <div style={{ position: 'relative' }}>
              <Search size={13} style={{ position: 'absolute', left: 9, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-dim)', pointerEvents: 'none' }} />
              <input
                value={vaultQuery}
                onChange={e => setVaultQuery(e.target.value)}
                placeholder="검색..."
                style={{
                  width: '100%', padding: '7px 7px 7px 28px', borderRadius: 8, border: '1px solid var(--border-dim)',
                  background: 'var(--bg-input)', color: 'var(--text)', fontSize: 12, outline: 'none', boxSizing: 'border-box',
                }}
              />
              {vaultQuery && (
                <button onClick={() => setVaultQuery('')} style={{ position: 'absolute', right: 7, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-dim)', padding: 0 }}>
                  <X size={12} />
                </button>
              )}
            </div>
          )}
        </div>

        {/* ── 메모 목록 ── */}
        {activeTab === 'notes' && (
          <div style={{ flex: 1, overflowY: 'auto', padding: '4px 8px 80px' }}>
            {filteredByQuery.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '40px 16px', color: 'var(--text-dim)', fontSize: 13 }}>
                {query || tagFilter ? '검색 결과 없음' : '메모가 없습니다\n+ 새 메모를 눌러 시작하세요'}
              </div>
            ) : filteredByQuery.map(note => {
              const tags = parseTags(note.tags)
              const isActive = selected?.id === note.id
              return (
                <div
                  key={note.id}
                  onClick={() => openNote(note)}
                  style={{
                    padding: '10px 10px',
                    borderRadius: 10,
                    marginBottom: 3,
                    cursor: 'pointer',
                    border: '1px solid',
                    borderColor: isActive ? 'var(--accent)' : 'transparent',
                    background: isActive ? 'var(--bg-hover)' : 'transparent',
                    position: 'relative',
                  }}
                  onMouseEnter={e => { if (!isActive) e.currentTarget.style.background = 'var(--bg-card)' }}
                  onMouseLeave={e => { if (!isActive) e.currentTarget.style.background = 'transparent' }}
                >
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: 6 }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-bright)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {noteDisplayTitle(note)}
                      </div>
                      <div style={{ fontSize: 11, color: 'var(--text-dim)', marginTop: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {note.content.slice(0, 60) || '내용 없음'}
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 5, flexWrap: 'wrap' }}>
                        <span style={{ fontSize: 10, color: 'var(--text-dim)' }}>{formatDate(note.updatedAt)}</span>
                        {note.date && (
                          <span style={{ fontSize: 10, color: 'var(--accent-light)', display: 'flex', alignItems: 'center', gap: 2 }}>
                            <Calendar size={9} />{note.date}
                          </span>
                        )}
                        {tags.slice(0, 2).map(t => (
                          <span key={t} style={{ fontSize: 10, padding: '1px 5px', borderRadius: 6, background: 'var(--bg-input)', color: 'var(--text-muted)', border: '1px solid var(--border-dim)' }}>{t}</span>
                        ))}
                        {tags.length > 2 && <span style={{ fontSize: 10, color: 'var(--text-dim)' }}>+{tags.length - 2}</span>}
                      </div>
                    </div>
                    {note.pinned && <Pin size={11} style={{ color: 'var(--accent-light)', flexShrink: 0, marginTop: 2 }} />}
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {/* ── 비밀 메모 목록/상태 ── */}
        {activeTab === 'vault' && (
          <div style={{ flex: 1, overflowY: 'auto', padding: '4px 8px 80px', display: 'flex', flexDirection: 'column' }}>

            {/* 로딩 */}
            {vaultStatus === 'loading' && (
              <div style={{ padding: '20px 8px', display: 'flex', flexDirection: 'column', gap: 8 }}>
                {[1, 2, 3].map(i => (
                  <div key={i} style={{ height: 56, borderRadius: 10, background: 'var(--bg-card)', border: '1px solid var(--border-dim)', animation: 'pulse 1.5s infinite' }} />
                ))}
              </div>
            )}

            {/* 설정 필요 */}
            {vaultStatus === 'setup' && (
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 16, padding: '24px 16px', textAlign: 'center' }}>
                <div style={{
                  width: 48, height: 48, borderRadius: 14,
                  background: 'var(--bg-card)', border: '1px solid var(--border-dim)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <Lock size={22} style={{ color: 'var(--text-muted)' }} />
                </div>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-bright)', marginBottom: 6 }}>비밀 메모 설정 필요</div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.6 }}>
                    비밀 메모를 사용하려면 마스터 비밀번호를 설정하세요
                  </div>
                </div>
                <a
                  href="/vault"
                  style={{
                    padding: '8px 18px', borderRadius: 10, border: 'none', cursor: 'pointer',
                    background: 'var(--accent)', color: '#fff', fontSize: 13, fontWeight: 600,
                    display: 'flex', alignItems: 'center', gap: 6, textDecoration: 'none',
                  }}
                >
                  <Shield size={14} />설정하기
                </a>
              </div>
            )}

            {/* 잠금 해제 폼 */}
            {vaultStatus === 'locked' && (
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 16, padding: '24px 16px' }}>
                <div style={{
                  width: 48, height: 48, borderRadius: 14,
                  background: 'var(--bg-card)', border: '1px solid var(--border-dim)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <Lock size={22} style={{ color: 'var(--text-muted)' }} />
                </div>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-bright)', marginBottom: 4 }}>비밀 메모 잠금됨</div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>마스터 비밀번호를 입력하세요</div>
                </div>
                <form onSubmit={handleVaultUnlock} style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 10 }}>
                  <div style={{ position: 'relative' }}>
                    <input
                      type={showVaultPassword ? 'text' : 'password'}
                      value={vaultPassword}
                      onChange={e => setVaultPassword(e.target.value)}
                      placeholder="마스터 비밀번호"
                      style={{
                        width: '100%', padding: '10px 40px 10px 12px', borderRadius: 10,
                        border: '1px solid var(--border)', background: 'var(--bg-input)',
                        color: 'var(--text)', fontSize: 13, outline: 'none', boxSizing: 'border-box',
                      }}
                      onFocus={e => { e.currentTarget.style.borderColor = 'var(--accent)' }}
                      onBlur={e => { e.currentTarget.style.borderColor = 'var(--border)' }}
                    />
                    <button type="button" onClick={() => setShowVaultPassword(p => !p)}
                      style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-dim)', padding: 0, display: 'flex' }}>
                      {showVaultPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                    </button>
                  </div>
                  {vaultPasswordError && (
                    <div style={{ fontSize: 12, color: 'var(--danger, #ef4444)', padding: '6px 10px', borderRadius: 8, background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)' }}>
                      {vaultPasswordError}
                    </div>
                  )}
                  <button type="submit" disabled={vaultAuthLoading || !vaultPassword}
                    style={{
                      padding: '10px', borderRadius: 10, border: 'none', cursor: vaultAuthLoading ? 'not-allowed' : 'pointer',
                      background: 'var(--accent)', color: '#fff', fontSize: 13, fontWeight: 600,
                      opacity: vaultAuthLoading || !vaultPassword ? 0.6 : 1,
                      display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                    }}
                  >
                    <Lock size={13} />
                    {vaultAuthLoading ? '잠금 해제 중...' : '잠금 해제'}
                  </button>
                </form>
              </div>
            )}

            {/* 자격증명 목록 */}
            {vaultStatus === 'unlocked' && (
              filteredCredentials.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '40px 16px', color: 'var(--text-dim)', fontSize: 13 }}>
                  {vaultQuery ? '검색 결과 없음' : '항목이 없습니다'}
                </div>
              ) : filteredCredentials.map(cred => {
                const isActive = selectedCred?.id === cred.id
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
              })
            )}
          </div>
        )}
      </div>

      {/* ── 에디터 패널 (메모) ── */}
      <div
        style={{
          flex: 1,
          display: activeTab === 'notes' && showEditor ? 'flex' : 'none',
          flexDirection: 'column',
          minWidth: 0,
          background: 'var(--bg-base)',
        }}
        className={activeTab === 'notes' ? 'md:!flex' : 'md:!hidden'}
      >
        {activeTab === 'notes' && selected ? (
          <>
            {/* 에디터 헤더 */}
            <div style={{
              display: 'flex', alignItems: 'center', gap: 8, padding: '12px 16px',
              borderBottom: '1px solid var(--border-dim)', flexShrink: 0,
              background: 'var(--bg-surface)',
            }}>
              {/* 모바일 뒤로가기 */}
              <button
                onClick={closeEditor}
                className="md:hidden"
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 4, display: 'flex' }}
              >
                <ChevronLeft size={18} />
              </button>

              {/* 제목 입력 */}
              <input
                value={draft.title}
                onChange={e => handleDraftChange('title', e.target.value)}
                placeholder="제목 (선택)"
                style={{
                  flex: 1, background: 'none', border: 'none', outline: 'none',
                  fontSize: 15, fontWeight: 600, color: 'var(--text-bright)',
                  minWidth: 0,
                }}
              />

              {/* 저장 상태 */}
              <span style={{ fontSize: 11, color: 'var(--text-dim)', flexShrink: 0 }}>
                {saving ? '저장 중...' : '자동 저장'}
              </span>

              {/* Pin 토글 */}
              <button
                onClick={e => togglePin(selected, e)}
                title={selected.pinned ? '고정 해제' : '고정'}
                style={{
                  background: selected.pinned ? 'var(--accent-dim)' : 'var(--bg-card)',
                  border: '1px solid var(--border-dim)',
                  borderRadius: 7, padding: '5px 7px', cursor: 'pointer', display: 'flex',
                  color: selected.pinned ? 'var(--accent-light)' : 'var(--text-dim)',
                }}
              >
                <Pin size={13} />
              </button>

              {/* 삭제 */}
              <button
                onClick={() => setShowDeleteConfirm(true)}
                style={{ background: 'none', border: '1px solid var(--border-dim)', borderRadius: 7, padding: '5px 7px', cursor: 'pointer', color: 'var(--text-dim)', display: 'flex' }}
                onMouseEnter={e => { e.currentTarget.style.color = 'var(--danger)'; e.currentTarget.style.borderColor = 'var(--danger)' }}
                onMouseLeave={e => { e.currentTarget.style.color = 'var(--text-dim)'; e.currentTarget.style.borderColor = 'var(--border-dim)' }}
              >
                <Trash2 size={13} />
              </button>
            </div>

            {/* 메타 (날짜 + 태그) */}
            <div style={{ padding: '8px 16px', borderBottom: '1px solid var(--border-dim)', display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap', background: 'var(--bg-surface)', flexShrink: 0 }}>
              {/* 날짜 연결 */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                <Calendar size={12} style={{ color: 'var(--text-dim)' }} />
                <input
                  type="date"
                  value={draft.date}
                  onChange={e => handleDraftChange('date', e.target.value)}
                  style={{
                    background: 'none', border: 'none', outline: 'none',
                    fontSize: 12, color: draft.date ? 'var(--accent-light)' : 'var(--text-dim)', cursor: 'pointer',
                  }}
                />
              </div>

              {/* 태그 */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexWrap: 'wrap' }}>
                <Tag size={11} style={{ color: 'var(--text-dim)' }} />
                {parseTags(draft.tags).map(tag => (
                  <span key={tag} style={{
                    display: 'flex', alignItems: 'center', gap: 3, padding: '2px 7px', borderRadius: 8,
                    background: 'var(--bg-input)', border: '1px solid var(--border-dim)', fontSize: 11, color: 'var(--text-muted)',
                  }}>
                    {tag}
                    <button onClick={() => removeTag(tag)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-dim)', padding: 0, display: 'flex' }}>
                      <X size={9} />
                    </button>
                  </span>
                ))}
                {showTagInput ? (
                  <input
                    autoFocus
                    value={tagInput}
                    onChange={e => setTagInput(e.target.value)}
                    onKeyDown={e => {
                      if (e.key === 'Enter' && !e.nativeEvent.isComposing) addTag()
                      if (e.key === 'Escape') { setShowTagInput(false); setTagInput('') }
                    }}
                    onBlur={() => { addTag(); setShowTagInput(false) }}
                    placeholder="태그 입력"
                    style={{
                      width: 80, padding: '2px 6px', borderRadius: 7, border: '1px solid var(--accent)',
                      background: 'var(--bg-input)', color: 'var(--text)', fontSize: 11, outline: 'none',
                    }}
                  />
                ) : (
                  <button
                    onClick={() => setShowTagInput(true)}
                    style={{ background: 'var(--bg-card)', border: '1px dashed var(--border)', borderRadius: 7, padding: '2px 7px', cursor: 'pointer', fontSize: 11, color: 'var(--text-dim)' }}
                  >
                    + 태그
                  </button>
                )}
              </div>
            </div>

            {/* 본문: WYSIWYG 에디터 */}
            <NoteEditor
              noteId={selected.id}
              content={draft.content}
              onChange={content => handleDraftChange('content', content)}
              autoFocus
            />
          </>
        ) : activeTab === 'notes' ? (
          /* 빈 상태 */
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12, color: 'var(--text-dim)' }}>
            <div style={{ fontSize: 40 }}>📝</div>
            <div style={{ fontSize: 14, color: 'var(--text-muted)' }}>메모를 선택하거나 새로 만드세요</div>
            <button
              onClick={newNote}
              style={{
                padding: '8px 18px', borderRadius: 10, border: 'none', cursor: 'pointer',
                background: 'var(--accent)', color: '#fff', fontSize: 13, fontWeight: 600,
                display: 'flex', alignItems: 'center', gap: 6,
              }}
            >
              <Plus size={14} />새 메모
            </button>
          </div>
        ) : null}
      </div>

      {/* ── 에디터 패널 (비밀 메모) ── */}
      <div
        style={{
          flex: 1,
          display: activeTab === 'vault' && showCredEditor ? 'flex' : 'none',
          flexDirection: 'column',
          minWidth: 0,
          background: 'var(--bg-base)',
        }}
        className={activeTab === 'vault' ? 'md:!flex' : 'md:!hidden'}
      >
        {activeTab === 'vault' && selectedCred ? (
          <>
            {/* 헤더 */}
            <div style={{
              display: 'flex', alignItems: 'center', gap: 8, padding: '12px 16px',
              borderBottom: '1px solid var(--border-dim)', flexShrink: 0, background: 'var(--bg-surface)',
            }}>
              <button onClick={() => setShowCredEditor(false)} className="md:hidden"
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 4, display: 'flex' }}>
                <ChevronLeft size={18} />
              </button>
              <input
                value={draftName}
                onChange={e => updateCredName(e.target.value)}
                placeholder="항목 이름"
                style={{ flex: 1, background: 'none', border: 'none', outline: 'none', fontSize: 15, fontWeight: 600, color: 'var(--text-bright)', minWidth: 0 }}
              />
              <span style={{ fontSize: 11, color: 'var(--text-dim)', flexShrink: 0 }}>
                {credSaving ? '저장 중...' : '자동 저장'}
              </span>
              <button onClick={e => toggleCredPin(selectedCred, e)} title={selectedCred.pinned ? '고정 해제' : '고정'}
                style={{
                  background: selectedCred.pinned ? 'var(--accent-dim)' : 'var(--bg-card)',
                  border: '1px solid var(--border-dim)', borderRadius: 7, padding: '5px 7px',
                  cursor: 'pointer', display: 'flex', color: selectedCred.pinned ? 'var(--accent-light)' : 'var(--text-dim)',
                }}>
                <Pin size={13} />
              </button>
              <button onClick={() => setShowCredDeleteConfirm(true)}
                style={{ background: 'none', border: '1px solid var(--border-dim)', borderRadius: 7, padding: '5px 7px', cursor: 'pointer', color: 'var(--text-dim)', display: 'flex' }}
                onMouseEnter={e => { e.currentTarget.style.color = 'var(--danger)'; e.currentTarget.style.borderColor = 'var(--danger)' }}
                onMouseLeave={e => { e.currentTarget.style.color = 'var(--text-dim)'; e.currentTarget.style.borderColor = 'var(--border-dim)' }}>
                <Trash2 size={13} />
              </button>
            </div>

            {/* 설명 */}
            <div style={{ padding: '8px 16px', borderBottom: '1px solid var(--border-dim)', background: 'var(--bg-surface)', flexShrink: 0 }}>
              <input
                value={draftDescription}
                onChange={e => updateCredDescription(e.target.value)}
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
                  onChange={e => updateCredNote(e.target.value)}
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
                생성: {formatDate(selectedCred.createdAt)} · 수정: {formatDate(selectedCred.updatedAt)}
              </div>
            </div>
          </>
        ) : activeTab === 'vault' && vaultStatus === 'unlocked' ? (
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
        ) : null}
      </div>

      {/* 삭제 확인 모달 (메모) */}
      {showDeleteConfirm && (
        <div
          style={{ position: 'fixed', inset: 0, zIndex: 100, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}
          onClick={() => setShowDeleteConfirm(false)}
        >
          <div
            style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 14, padding: 24, maxWidth: 320, width: '100%' }}
            onClick={e => e.stopPropagation()}
          >
            <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-bright)', marginBottom: 8 }}>메모 삭제</div>
            <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 20 }}>
              &ldquo;{selected && noteDisplayTitle(selected)}&rdquo;를 삭제합니다. 되돌릴 수 없습니다.
            </div>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button
                onClick={() => setShowDeleteConfirm(false)}
                style={{ padding: '7px 14px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg-card)', color: 'var(--text-muted)', cursor: 'pointer', fontSize: 13 }}
              >
                취소
              </button>
              <button
                onClick={deleteNote}
                style={{ padding: '7px 14px', borderRadius: 8, border: 'none', background: 'var(--danger)', color: '#fff', cursor: 'pointer', fontSize: 13, fontWeight: 600 }}
              >
                삭제
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 삭제 확인 모달 (비밀 메모) */}
      {showCredDeleteConfirm && (
        <div
          style={{ position: 'fixed', inset: 0, zIndex: 100, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}
          onClick={() => setShowCredDeleteConfirm(false)}
        >
          <div
            style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 14, padding: 24, maxWidth: 320, width: '100%' }}
            onClick={e => e.stopPropagation()}
          >
            <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-bright)', marginBottom: 8 }}>항목 삭제</div>
            <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 20 }}>
              &ldquo;{selectedCred?.name}&rdquo;를 삭제합니다. 되돌릴 수 없습니다.
            </div>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button
                onClick={() => setShowCredDeleteConfirm(false)}
                style={{ padding: '7px 14px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg-card)', color: 'var(--text-muted)', cursor: 'pointer', fontSize: 13 }}
              >
                취소
              </button>
              <button
                onClick={deleteCredential}
                style={{ padding: '7px 14px', borderRadius: 8, border: 'none', background: 'var(--danger, #ef4444)', color: '#fff', cursor: 'pointer', fontSize: 13, fontWeight: 600 }}
              >
                삭제
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 모바일: 목록에 새 메모 FAB */}
      {activeTab === 'notes' && !showEditor && (
        <button
          onClick={newNote}
          className="md:hidden"
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

      {/* 모바일: 비밀 메모 FAB */}
      {activeTab === 'vault' && vaultStatus === 'unlocked' && !showCredEditor && (
        <button
          onClick={newCredential}
          className="md:hidden"
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
