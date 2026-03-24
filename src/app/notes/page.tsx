'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { Pin, Plus, Search, Trash2, ChevronLeft, X, Tag, Calendar } from 'lucide-react'
import { parseTags, sanitizeTag, serializeTags, noteDisplayTitle, matchesSearch } from '@/lib/noteUtils'

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

/** 인라인 마크다운(굵기·코드)을 React 노드 배열로 변환 */
function buildInlineParts(content: string, lineKey: number): React.ReactNode[] {
  const combined = content
    .replace(/\*\*(.+?)\*\*/g, '\x00bold\x00$1\x00/bold\x00')
    .replace(/`(.+?)`/g, '\x00code\x00$1\x00/code\x00')
  const segments = combined.split('\x00')
  const parts: React.ReactNode[] = []
  let bold = false
  let code = false
  segments.forEach((seg, j) => {
    if (seg === 'bold') { bold = true; return }
    if (seg === '/bold') { bold = false; return }
    if (seg === 'code') { code = true; return }
    if (seg === '/code') { code = false; return }
    if (!seg) return
    if (bold) {
      parts.push(<strong key={`${lineKey}-${j}`} style={{ color: 'var(--text-bright)', fontWeight: 600 }}>{seg}</strong>)
    } else if (code) {
      parts.push(
        <code key={`${lineKey}-${j}`} style={{
          background: 'var(--bg-input)', color: 'var(--accent-light)',
          padding: '1px 5px', borderRadius: 4, fontSize: '0.85em', fontFamily: 'monospace',
        }}>{seg}</code>
      )
    } else {
      parts.push(seg)
    }
  })
  return parts
}

function renderMarkdown(text: string): React.ReactNode[] {
  return text.split('\n').map((line, i) => {
    // 수평선
    if (line === '---') {
      return <hr key={i} style={{ border: 'none', borderTop: '1px solid var(--border)', margin: '8px 0' }} />
    }

    // 접두사 파악 & 본문 분리 (헤딩/불릿 prefix는 파싱에서 제외)
    let content = line
    let type: 'h1' | 'h2' | 'bullet' | 'plain' = 'plain'
    if (line.startsWith('# ')) { type = 'h1'; content = line.slice(2) }
    else if (line.startsWith('## ')) { type = 'h2'; content = line.slice(3) }
    else if (line.startsWith('- ') || line.startsWith('* ')) { type = 'bullet'; content = line.slice(2) }

    const parts = buildInlineParts(content, i)
    const inner = parts.length > 0 ? parts : content

    if (type === 'h1') {
      return <div key={i} style={{ fontWeight: 700, fontSize: '1.1em', color: 'var(--text-bright)', marginTop: 8 }}>{inner}</div>
    }
    if (type === 'h2') {
      return <div key={i} style={{ fontWeight: 600, color: 'var(--text-bright)', marginTop: 6 }}>{inner}</div>
    }
    if (type === 'bullet') {
      return (
        <div key={i} style={{ display: 'flex', gap: 6, alignItems: 'flex-start' }}>
          <span style={{ color: 'var(--accent-light)', flexShrink: 0, marginTop: 2 }}>•</span>
          <span>{inner}</span>
        </div>
      )
    }
    return <div key={i} style={{ minHeight: content ? undefined : '0.75em' }}>{inner}</div>
  })
}

export default function NotesPage() {
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
  const [previewMode, setPreviewMode] = useState(false)
  const saveTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const contentRef = useRef<HTMLTextAreaElement>(null)

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

  const openNote = (note: Note) => {
    clearTimeout(saveTimer.current)
    setSelected(note)
    setDraft({
      title: note.title ?? '',
      content: note.content,
      tags: note.tags ?? '',
      date: note.date ?? '',
    })
    setPreviewMode(false)
    setShowEditor(true)
  }

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
      setTimeout(() => contentRef.current?.focus(), 100)
    }
  }

  const scheduleSave = (newDraft: typeof draft) => {
    clearTimeout(saveTimer.current)
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

  return (
    <div style={{ display: 'flex', height: '100dvh', overflow: 'hidden', background: 'var(--bg-base)' }}>

      {/* ── 목록 패널 ── */}
      <div
        style={{
          minWidth: 0,
          flexShrink: 0,
          display: showEditor ? 'none' : 'flex',
          flexDirection: 'column',
          borderRight: '1px solid var(--border-dim)',
          background: 'var(--bg-surface)',
          width: '100%',
        }}
        className="md:!flex md:!w-72 lg:!w-80"
      >
        {/* 목록 헤더 */}
        <div style={{ padding: '16px 12px 8px', flexShrink: 0 }}>
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
        </div>

        {/* 메모 목록 */}
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
      </div>

      {/* ── 에디터 패널 ── */}
      <div
        style={{
          flex: 1,
          display: showEditor ? 'flex' : 'none',
          flexDirection: 'column',
          minWidth: 0,
          background: 'var(--bg-base)',
        }}
        className="md:!flex"
      >
        {selected ? (
          <>
            {/* 에디터 헤더 */}
            <div style={{
              display: 'flex', alignItems: 'center', gap: 8, padding: '12px 16px',
              borderBottom: '1px solid var(--border-dim)', flexShrink: 0,
              background: 'var(--bg-surface)',
            }}>
              {/* 모바일 뒤로가기 */}
              <button
                onClick={() => setShowEditor(false)}
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

              {/* 미리보기 토글 */}
              <button
                onClick={() => setPreviewMode(p => !p)}
                style={{
                  background: previewMode ? 'var(--accent-dim)' : 'var(--bg-card)',
                  border: '1px solid var(--border-dim)',
                  borderRadius: 7, padding: '4px 9px', cursor: 'pointer',
                  fontSize: 11, color: previewMode ? 'var(--accent-light)' : 'var(--text-dim)',
                }}
              >
                {previewMode ? '편집' : '미리보기'}
              </button>

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

            {/* 본문: 편집 or 미리보기 */}
            {previewMode ? (
              <div
                style={{
                  flex: 1, padding: '20px', overflowY: 'auto',
                  color: 'var(--text)', fontSize: 14, lineHeight: 1.7,
                }}
              >
                {renderMarkdown(draft.content)}
              </div>
            ) : (
              <textarea
                ref={contentRef}
                value={draft.content}
                onChange={e => handleDraftChange('content', e.target.value)}
                placeholder={'내용을 입력하세요...\n\n마크다운 지원: **굵게**, `코드`, - 목록, # 제목, ---'}
                style={{
                  flex: 1, padding: '20px', resize: 'none', background: 'var(--bg-base)',
                  border: 'none', outline: 'none', color: 'var(--text)', fontSize: 14,
                  lineHeight: 1.7, fontFamily: 'inherit',
                }}
              />
            )}
          </>
        ) : (
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

      {/* 모바일: 목록에 새 메모 FAB */}
      {!showEditor && (
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
    </div>
  )
}
