'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { format } from 'date-fns'
import { ChevronLeft, ChevronDown, ChevronRight, Plus, Check, X, Target, Trash2, Pencil, Calendar } from 'lucide-react'
import AIPanel from '@/components/AIPanel'

interface Todo {
  id: string
  title: string
  completed: boolean
  priority: string
  date: string | null
  sectionId: string | null
}

interface ProjectSection {
  id: string
  title: string
  isOpen: boolean
  order: number
  todos: Todo[]
}

interface Project {
  id: string
  name: string
  description: string | null
  color: string
  goal: string | null
  sections: ProjectSection[]
  todos: Todo[]
}

const CLOSED = '__none__'
const UNSECTIONED = 'unsectioned'

const PRIORITY_COLOR: Record<string, string> = {
  high: '#a85848',
  medium: '#c4935a',
  low: '#95a586',
}

// ── IME-safe Enter handler ──────────────────────────────────────────────────
function useImeInput(onSubmit: () => void, onCancel: () => void) {
  const isComposing = useRef(false)
  return {
    onCompositionStart: () => { isComposing.current = true },
    onCompositionEnd: () => { isComposing.current = false },
    onKeyDown: (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' && !isComposing.current) { e.preventDefault(); onSubmit() }
      if (e.key === 'Escape') onCancel()
    },
  }
}

// ── TodoItem ────────────────────────────────────────────────────────────────
function TodoItem({
  todo,
  onToggle,
  onDelete,
  onUpdate,
}: {
  todo: Todo
  onToggle: () => void
  onDelete: () => void
  onUpdate: (title: string, date: string | null) => void
}) {
  const [editing, setEditing] = useState(false)
  const [editTitle, setEditTitle] = useState(todo.title)
  const [editDate, setEditDate] = useState(todo.date ? todo.date.slice(0, 10) : '')

  const submit = () => {
    const t = editTitle.trim()
    if (t) onUpdate(t, editDate || null)
    setEditing(false)
  }
  const cancel = () => {
    setEditTitle(todo.title)
    setEditDate(todo.date ? todo.date.slice(0, 10) : '')
    setEditing(false)
  }

  const imeProps = useImeInput(submit, cancel)

  if (editing) {
    return (
      <div className="flex flex-col gap-1 px-3 py-2">
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 rounded border flex-shrink-0" style={{ borderColor: 'var(--border)' }} />
          <div className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: PRIORITY_COLOR[todo.priority] ?? PRIORITY_COLOR.medium, opacity: 0.8 }} />
          <input
            type="text"
            value={editTitle}
            onChange={e => setEditTitle(e.target.value)}
            {...imeProps}
            className="flex-1 bg-transparent text-sm focus:outline-none"
            style={{ borderBottom: '1px solid var(--accent-dim)', color: 'var(--text)' }}
            autoFocus
          />
          <button onClick={submit} style={{ color: 'var(--accent)' }}><Check size={14} /></button>
          <button onClick={cancel} style={{ color: 'var(--text-dim)' }}><X size={14} /></button>
        </div>
        <div className="flex items-center gap-2 pl-8">
          <Calendar size={11} style={{ color: 'var(--text-dim)' }} />
          <input
            type="date"
            value={editDate}
            onChange={e => setEditDate(e.target.value)}
            className="text-xs focus:outline-none rounded px-1.5 py-0.5"
            style={{ background: 'var(--bg-input)', border: '1px solid var(--border)', color: 'var(--text-muted)' }}
          />
          {editDate && (
            <button
              onClick={() => setEditDate('')}
              className="text-[10px]"
              style={{ color: 'var(--text-dim)' }}
            >
              기한 제거
            </button>
          )}
        </div>
      </div>
    )
  }

  return (
    <div
      className="flex items-center gap-2 group px-3 py-1.5 rounded-lg transition-all"
      onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-hover)')}
      onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
    >
      <button
        onClick={onToggle}
        className="w-4 h-4 rounded border flex items-center justify-center flex-shrink-0 transition-all"
        style={{
          background: todo.completed ? 'var(--accent-dim)' : 'transparent',
          borderColor: todo.completed ? 'var(--accent)' : 'var(--border)',
        }}
      >
        {todo.completed && <Check size={10} style={{ color: 'var(--accent-light)' }} />}
      </button>
      <div
        className="w-1.5 h-1.5 rounded-full flex-shrink-0"
        style={{ background: PRIORITY_COLOR[todo.priority] ?? PRIORITY_COLOR.medium, opacity: todo.completed ? 0.3 : 0.8 }}
      />
      <span
        className="flex-1 text-sm"
        style={{ color: todo.completed ? 'var(--text-dim)' : 'var(--text)', textDecoration: todo.completed ? 'line-through' : 'none' }}
      >
        {todo.title}
      </span>
      {todo.date && (
        <span
          className="text-[10px] px-1.5 py-0.5 rounded-md flex-shrink-0"
          style={{ background: 'var(--bg-input)', color: 'var(--text-dim)', border: '1px solid var(--border-dim)' }}
        >
          {format(new Date(todo.date), 'MM/dd')}
        </span>
      )}
      <button
        onClick={() => setEditing(true)}
        className="opacity-0 group-hover:opacity-100 transition-all"
        style={{ color: 'var(--text-dim)' }}
        onMouseEnter={e => (e.currentTarget.style.color = 'var(--accent)')}
        onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-dim)')}
      >
        <Pencil size={11} />
      </button>
      <button
        onClick={onDelete}
        className="opacity-0 group-hover:opacity-100 transition-all"
        style={{ color: 'var(--text-dim)' }}
        onMouseEnter={e => (e.currentTarget.style.color = 'var(--danger, #ef4444)')}
        onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-dim)')}
      >
        <Trash2 size={12} />
      </button>
    </div>
  )
}

// ── AddTodoInline ───────────────────────────────────────────────────────────
function AddTodoInline({
  forKey,
  addingFor,
  isMobile,
  onOpen,
  onClose,
  onAdd,
}: {
  forKey: string
  addingFor: string
  isMobile: boolean
  onOpen: () => void
  onClose: () => void
  onAdd: (title: string, date: string | null) => void
}) {
  const [title, setTitle] = useState('')
  const [date, setDate] = useState('')

  const submit = () => {
    const t = title.trim()
    if (t) onAdd(t, date || null)
    setTitle('')
    setDate('')
  }
  const cancel = () => {
    setTitle('')
    setDate('')
    onClose()
  }

  const imeProps = useImeInput(submit, cancel)

  const isActive = addingFor === forKey

  if (!isActive) {
    return (
      <button
        onClick={onOpen}
        className="flex items-center gap-1.5 px-3 py-1.5 text-xs w-full transition-colors"
        style={{ color: 'var(--text-dim)' }}
        onMouseEnter={e => (e.currentTarget.style.color = 'var(--accent)')}
        onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-dim)')}
      >
        <Plus size={12} /><span>할일 추가</span>
      </button>
    )
  }

  // 모바일: 고정 바텀 시트가 처리하므로 인디케이터만 표시
  if (isMobile) {
    return (
      <div
        className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg"
        style={{ color: 'var(--accent-light)', background: 'var(--accent-dim)' }}
      >
        <Plus size={12} /><span>입력 중...</span>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-1 px-3 py-1.5">
      <div className="flex items-center gap-2">
        <div className="w-4 h-4 rounded border flex-shrink-0" style={{ borderColor: 'var(--border)' }} />
        <div className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: PRIORITY_COLOR.medium, opacity: 0.8 }} />
        <input
          type="text"
          value={title}
          onChange={e => setTitle(e.target.value)}
          {...imeProps}
          placeholder="할일 이름..."
          className="flex-1 bg-transparent py-0.5 text-sm focus:outline-none"
          style={{ borderBottom: '1px solid var(--accent-dim)', color: 'var(--text)' }}
          autoFocus
        />
        <button onClick={submit} style={{ color: 'var(--accent)' }}><Check size={14} /></button>
        <button onClick={cancel} style={{ color: 'var(--text-dim)' }}><X size={14} /></button>
      </div>
      <div className="flex items-center gap-2 pl-8">
        <Calendar size={11} style={{ color: 'var(--text-dim)' }} />
        <input
          type="date"
          value={date}
          onChange={e => setDate(e.target.value)}
          className="text-xs focus:outline-none rounded px-1.5 py-0.5"
          style={{ background: 'var(--bg-input)', border: '1px solid var(--border)', color: 'var(--text-muted)' }}
        />
      </div>
    </div>
  )
}

// ── SectionHeader ───────────────────────────────────────────────────────────
function SectionHeader({
  section,
  isOpen,
  onToggle,
  onRename,
}: {
  section: ProjectSection
  isOpen: boolean
  onToggle: () => void
  onRename: (title: string) => void
}) {
  const [editing, setEditing] = useState(false)
  const [editTitle, setEditTitle] = useState(section.title)

  const submit = () => {
    const t = editTitle.trim()
    if (t && t !== section.title) onRename(t)
    setEditing(false)
  }
  const cancel = () => {
    setEditTitle(section.title)
    setEditing(false)
  }
  const imeProps = useImeInput(submit, cancel)

  return (
    <div
      className="flex items-center gap-2 px-4 py-3 w-full transition-colors group"
      style={{ borderBottom: '1px solid var(--border-dim)' }}
    >
      <button onClick={onToggle} className="flex-shrink-0">
        {isOpen
          ? <ChevronDown size={16} style={{ color: 'var(--text-dim)' }} />
          : <ChevronRight size={16} style={{ color: 'var(--text-dim)' }} />
        }
      </button>

      {editing ? (
        <input
          type="text"
          value={editTitle}
          onChange={e => setEditTitle(e.target.value)}
          {...imeProps}
          className="flex-1 bg-transparent text-sm font-medium focus:outline-none"
          style={{ borderBottom: '1px solid var(--accent-dim)', color: 'var(--text)' }}
          autoFocus
          onBlur={submit}
        />
      ) : (
        <span
          className="text-sm font-medium flex-1 cursor-text"
          style={{ color: 'var(--text)' }}
          onClick={() => setEditing(true)}
          title="클릭하여 이름 수정"
        >
          {section.title}
        </span>
      )}

      {!editing && (
        <>
          <button
            onClick={() => setEditing(true)}
            className="opacity-0 group-hover:opacity-100 transition-all"
            style={{ color: 'var(--text-dim)' }}
          >
            <Pencil size={11} />
          </button>
          <span className="text-xs ml-auto" style={{ color: 'var(--text-dim)' }}>
            {section.todos.filter(t => t.completed).length}/{section.todos.length}
          </span>
        </>
      )}
    </div>
  )
}

// ── Main page ───────────────────────────────────────────────────────────────
export default function ProjectDetailPage() {
  const params = useParams()
  const router = useRouter()
  const projectId = params.id as string

  const [project, setProject] = useState<Project | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [openSections, setOpenSections] = useState<Set<string>>(new Set())
  const [addingFor, setAddingFor] = useState<string>(CLOSED)
  const [addingSectionTitle, setAddingSectionTitle] = useState(false)
  const [newSectionTitle, setNewSectionTitle] = useState('')
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [isMobile, setIsMobile] = useState(false)
  // 모바일 바텀 시트용 임시 상태
  const [mobileTodoTitle, setMobileTodoTitle] = useState('')
  const [mobileTodoDate, setMobileTodoDate] = useState('')

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768)
    check()
    window.addEventListener('resize', check)
    return () => window.removeEventListener('resize', check)
  }, [])

  const deleteProject = async () => {
    try {
      await fetch(`/api/projects/${projectId}`, { method: 'DELETE' })
      router.push('/projects')
    } catch {
      setConfirmDelete(false)
    }
  }

  const fetchProject = useCallback(async () => {
    try {
      const res = await fetch(`/api/projects/${projectId}`)
      if (!res.ok) {
        if (res.status === 404) router.push('/projects')
        throw new Error('Failed')
      }
      const data = await res.json()
      setProject(data)
      setOpenSections(new Set(data.sections.filter((s: ProjectSection) => s.isOpen).map((s: ProjectSection) => s.id)))
      setError(null)
    } catch {
      setError('프로젝트를 불러올 수 없습니다.')
    } finally {
      setLoading(false)
    }
  }, [projectId, router])

  useEffect(() => { fetchProject() }, [fetchProject])

  const toggleSection = (sectionId: string) => {
    setOpenSections(prev => {
      const next = new Set(prev)
      next.has(sectionId) ? next.delete(sectionId) : next.add(sectionId)
      return next
    })
  }

  const toggleTodo = async (todoId: string, currentCompleted: boolean) => {
    if (!project) return
    const update = (t: Todo) => t.id === todoId ? { ...t, completed: !currentCompleted } : t
    setProject(p => p ? { ...p, todos: p.todos.map(update), sections: p.sections.map(s => ({ ...s, todos: s.todos.map(update) })) } : p)
    await fetch(`/api/todos/${todoId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ completed: !currentCompleted }),
    }).catch(() => fetchProject())
  }

  const updateTodo = async (todoId: string, title: string, date: string | null) => {
    if (!project) return
    const update = (t: Todo) => t.id === todoId ? { ...t, title, date } : t
    setProject(p => p ? { ...p, todos: p.todos.map(update), sections: p.sections.map(s => ({ ...s, todos: s.todos.map(update) })) } : p)
    await fetch(`/api/todos/${todoId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title, date }),
    }).catch(() => fetchProject())
  }

  const deleteTodo = async (todoId: string) => {
    if (!project) return
    setProject(p => p ? {
      ...p,
      todos: p.todos.filter(t => t.id !== todoId),
      sections: p.sections.map(s => ({ ...s, todos: s.todos.filter(t => t.id !== todoId) })),
    } : p)
    await fetch(`/api/todos/${todoId}`, { method: 'DELETE' }).catch(() => fetchProject())
  }

  const addTodo = async (key: string, title: string, date: string | null) => {
    if (!project) return
    const actualSectionId = key === UNSECTIONED ? null : key
    const tempId = `temp-${Date.now()}`
    const newTodo: Todo = { id: tempId, title, completed: false, priority: 'medium', date, sectionId: actualSectionId }

    setProject(p => p
      ? actualSectionId
        ? { ...p, sections: p.sections.map(s => s.id === actualSectionId ? { ...s, todos: [...s.todos, newTodo] } : s) }
        : { ...p, todos: [...p.todos, newTodo] }
      : p
    )
    setAddingFor(CLOSED)
    setMobileTodoTitle('')
    setMobileTodoDate('')

    try {
      const res = await fetch('/api/todos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, date, projectId: project.id, sectionId: actualSectionId }),
      })
      if (!res.ok) throw new Error('Failed')
      const created = await res.json()
      setProject(p => p ? {
        ...p,
        todos: p.todos.map(t => t.id === tempId ? created : t),
        sections: p.sections.map(s => ({ ...s, todos: s.todos.map(t => t.id === tempId ? created : t) })),
      } : p)
    } catch {
      fetchProject()
    }
  }

  const renameSection = async (sectionId: string, title: string) => {
    setProject(p => p ? {
      ...p,
      sections: p.sections.map(s => s.id === sectionId ? { ...s, title } : s),
    } : p)
    await fetch(`/api/projects/${projectId}/sections/${sectionId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title }),
    }).catch(() => fetchProject())
  }

  const addSection = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newSectionTitle.trim() || !project) return
    try {
      const res = await fetch(`/api/projects/${projectId}/sections`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: newSectionTitle.trim() }),
      })
      if (!res.ok) throw new Error('Failed')
      const newSection = await res.json()
      setProject(p => p ? { ...p, sections: [...p.sections, newSection] } : p)
      setOpenSections(prev => new Set([...prev, newSection.id]))
      setNewSectionTitle('')
      setAddingSectionTitle(false)
    } catch {
      // silent
    }
  }

  if (loading) {
    return (
      <div className="space-y-4 max-w-2xl">
        {/* 헤더 스켈레톤 */}
        <div className="h-4 w-24 rounded-full animate-pulse" style={{ background: 'var(--bg-card)' }} />
        <div className="flex items-start gap-4 mb-6">
          <div className="w-1 h-20 rounded-full animate-pulse" style={{ background: 'var(--bg-card)' }} />
          <div className="flex-1 space-y-2">
            <div className="h-6 w-48 rounded-full animate-pulse" style={{ background: 'var(--bg-card)' }} />
            <div className="h-3 w-64 rounded-full animate-pulse" style={{ background: 'var(--bg-card)' }} />
            <div className="h-2 w-32 rounded-full animate-pulse mt-3" style={{ background: 'var(--bg-card)' }} />
          </div>
        </div>
        {/* 카드 스켈레톤 */}
        {[1, 2].map(i => (
          <div key={i} className="rounded-xl h-32 animate-pulse" style={{ background: 'var(--bg-card)', border: '1px solid var(--border-dim)' }} />
        ))}
      </div>
    )
  }
  if (error || !project) {
    return (
      <div className="flex flex-col items-center justify-center py-24">
        <div className="mb-4" style={{ color: 'var(--danger)' }}>{error || '프로젝트를 찾을 수 없습니다.'}</div>
        <Link href="/projects" style={{ color: 'var(--accent)' }} className="text-sm">프로젝트 목록으로</Link>
      </div>
    )
  }

  const allTodos = [...project.todos, ...project.sections.flatMap(s => s.todos)]
  const completedCount = allTodos.filter(t => t.completed).length
  const totalCount = allTodos.length

  return (
    <div>
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-4">
        <Link
          href="/projects"
          className="inline-flex items-center gap-1 text-sm transition-colors"
          style={{ color: 'var(--text-muted)' }}
          onMouseEnter={e => (e.currentTarget.style.color = 'var(--text-bright)')}
          onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-muted)')}
        >
          <ChevronLeft size={16} />프로젝트 목록
        </Link>
        <AIPanel
          projectId={project.id}
          projectName={project.name}
          modes={['project']}
          defaultMode="project"
        />
        <button
          onClick={() => setConfirmDelete(true)}
          className="p-1.5 rounded-lg transition-all"
          style={{ color: 'var(--text-dim)', background: 'var(--bg-card)', border: '1px solid var(--border)' }}
          title="프로젝트 삭제"
        >
          <Trash2 size={15} />
        </button>
        </div>

        <div className="flex items-start gap-4">
          <div className="w-1 self-stretch rounded-full flex-shrink-0" style={{ backgroundColor: project.color }} />
          <div className="flex-1">
            <h2 className="text-2xl font-bold" style={{ color: 'var(--text-bright)' }}>{project.name}</h2>
            {project.description && (
              <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>{project.description}</p>
            )}
            {project.goal && (
              <div className="mt-3 flex items-start gap-2 p-3 rounded-xl max-w-2xl" style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
                <Target size={16} className="mt-0.5 flex-shrink-0" style={{ color: 'var(--accent)' }} />
                <div>
                  <div className="text-xs mb-0.5" style={{ color: 'var(--text-dim)' }}>목표</div>
                  <div className="text-sm" style={{ color: 'var(--text)' }}>{project.goal}</div>
                </div>
              </div>
            )}
            <div className="mt-4 flex items-center gap-3 max-w-xs">
              <div className="flex-1 rounded-full h-2" style={{ background: 'var(--bg-input)' }}>
                <div
                  className="h-2 rounded-full transition-all"
                  style={{ width: `${totalCount > 0 ? (completedCount / totalCount) * 100 : 0}%`, backgroundColor: project.color }}
                />
              </div>
              <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{completedCount}/{totalCount} 완료</span>
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-2xl space-y-4">
        {/* Unsectioned todos */}
        <div className="rounded-xl overflow-hidden" style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
          <div className="px-4 py-3" style={{ borderBottom: '1px solid var(--border-dim)' }}>
            <span className="text-sm font-medium" style={{ color: 'var(--text-muted)' }}>기본</span>
          </div>
          <div className="py-1">
            {project.todos.map(todo => (
              <TodoItem
                key={todo.id}
                todo={todo}
                onToggle={() => toggleTodo(todo.id, todo.completed)}
                onDelete={() => deleteTodo(todo.id)}
                onUpdate={(title, date) => updateTodo(todo.id, title, date)}
              />
            ))}
            <AddTodoInline
              forKey={UNSECTIONED}
              addingFor={addingFor}
              isMobile={isMobile}
              onOpen={() => { setAddingFor(UNSECTIONED); setMobileTodoTitle(''); setMobileTodoDate('') }}
              onClose={() => setAddingFor(CLOSED)}
              onAdd={(title, date) => addTodo(UNSECTIONED, title, date)}
            />
          </div>
        </div>

        {/* Sections */}
        {project.sections.map(section => {
          const isOpen = openSections.has(section.id)
          return (
            <div key={section.id} className="rounded-xl overflow-hidden" style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
              <SectionHeader
                section={section}
                isOpen={isOpen}
                onToggle={() => toggleSection(section.id)}
                onRename={title => renameSection(section.id, title)}
              />
              {isOpen && (
                <div className="py-1">
                  {section.todos.map(todo => (
                    <TodoItem
                      key={todo.id}
                      todo={todo}
                      onToggle={() => toggleTodo(todo.id, todo.completed)}
                      onDelete={() => deleteTodo(todo.id)}
                      onUpdate={(title, date) => updateTodo(todo.id, title, date)}
                    />
                  ))}
                  <AddTodoInline
                    forKey={section.id}
                    addingFor={addingFor}
                    isMobile={isMobile}
                    onOpen={() => { setAddingFor(section.id); setMobileTodoTitle(''); setMobileTodoDate('') }}
                    onClose={() => setAddingFor(CLOSED)}
                    onAdd={(title, date) => addTodo(section.id, title, date)}
                  />
                </div>
              )}
            </div>
          )
        })}

        {/* Add Section */}
        {addingSectionTitle && !isMobile ? (
          <form onSubmit={addSection} className="flex gap-2">
            <input
              type="text"
              value={newSectionTitle}
              onChange={e => setNewSectionTitle(e.target.value)}
              placeholder="섹션 이름..."
              className="flex-1 rounded-xl px-4 py-2.5 text-sm focus:outline-none"
              style={{ background: 'var(--bg-card)', border: '1px solid var(--accent-dim)', color: 'var(--text)' }}
              autoFocus
              onKeyDown={e => { if (e.key === 'Escape') { setAddingSectionTitle(false); setNewSectionTitle('') } }}
            />
            <button type="submit" className="px-4 py-2.5 text-sm rounded-xl" style={{ background: 'var(--accent-dim)', border: '1px solid var(--accent)', color: 'var(--accent-light)' }}>
              추가
            </button>
            <button type="button" onClick={() => { setAddingSectionTitle(false); setNewSectionTitle('') }} className="px-4 py-2.5 text-sm rounded-xl" style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', color: 'var(--text-muted)' }}>
              취소
            </button>
          </form>
        ) : addingSectionTitle && isMobile ? (
          <button
            className="flex items-center gap-2 px-4 py-2.5 w-full text-sm rounded-xl"
            style={{ background: 'var(--accent-dim)', border: '1px solid var(--accent)', color: 'var(--accent-light)' }}
          >
            <Plus size={16} />섹션 입력 중...
          </button>
        ) : (
          <button
            onClick={() => { setAddingSectionTitle(true); setNewSectionTitle('') }}
            className="flex items-center gap-2 px-4 py-2.5 w-full text-sm rounded-xl transition-all"
            style={{ background: 'var(--bg-card)', border: '1px dashed var(--border)', color: 'var(--text-dim)' }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--accent-dim)'; e.currentTarget.style.color = 'var(--accent)' }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.color = 'var(--text-dim)' }}
          >
            <Plus size={16} />섹션 추가
          </button>
        )}
      </div>

      {/* 모바일 할일 추가 바텀 시트 */}
      {isMobile && addingFor !== CLOSED && (
        <div
          style={{
            position: 'fixed',
            left: 0,
            right: 0,
            bottom: 0,
            zIndex: 1000,
            background: 'var(--bg-surface)',
            borderTop: '1px solid var(--border)',
            padding: '12px 16px',
            paddingBottom: 'max(12px, env(safe-area-inset-bottom))',
            boxShadow: '0 -4px 20px rgba(0,0,0,0.3)',
          }}
        >
          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={mobileTodoTitle}
                onChange={e => setMobileTodoTitle(e.target.value)}
                onKeyDown={e => {
                  if (e.nativeEvent.isComposing) return
                  if (e.key === 'Enter' && mobileTodoTitle.trim()) {
                    addTodo(addingFor, mobileTodoTitle.trim(), mobileTodoDate || null)
                  }
                  if (e.key === 'Escape') { setAddingFor(CLOSED); setMobileTodoTitle(''); setMobileTodoDate('') }
                }}
                placeholder="할일 이름..."
                className="flex-1 text-[14px] focus:outline-none rounded-xl px-3 py-2.5"
                style={{ background: 'var(--bg-input)', border: '1px solid var(--accent-dim)', color: 'var(--text)' }}
                autoFocus
              />
              <button
                onClick={() => {
                  if (mobileTodoTitle.trim()) addTodo(addingFor, mobileTodoTitle.trim(), mobileTodoDate || null)
                }}
                className="p-2.5 rounded-xl flex-shrink-0"
                style={{ background: 'var(--accent-dim)', color: 'var(--accent-light)', border: '1px solid var(--accent)' }}
              >
                <Check size={16} />
              </button>
              <button
                onClick={() => { setAddingFor(CLOSED); setMobileTodoTitle(''); setMobileTodoDate('') }}
                className="p-2.5 rounded-xl flex-shrink-0"
                style={{ background: 'var(--bg-card)', color: 'var(--text-dim)', border: '1px solid var(--border)' }}
              >
                <X size={16} />
              </button>
            </div>
            <div className="flex items-center gap-2 px-1">
              <Calendar size={12} style={{ color: 'var(--text-dim)' }} />
              <input
                type="date"
                value={mobileTodoDate}
                onChange={e => setMobileTodoDate(e.target.value)}
                className="text-xs focus:outline-none rounded-lg px-2 py-1.5"
                style={{ background: 'var(--bg-input)', border: '1px solid var(--border)', color: 'var(--text-muted)' }}
              />
              {mobileTodoDate && (
                <button onClick={() => setMobileTodoDate('')} className="text-[11px]" style={{ color: 'var(--text-dim)' }}>
                  기한 제거
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* 모바일 섹션 추가 바텀 시트 */}
      {isMobile && addingSectionTitle && (
        <div
          style={{
            position: 'fixed',
            left: 0,
            right: 0,
            bottom: 0,
            zIndex: 1000,
            background: 'var(--bg-surface)',
            borderTop: '1px solid var(--border)',
            padding: '12px 16px',
            paddingBottom: 'max(12px, env(safe-area-inset-bottom))',
            boxShadow: '0 -4px 20px rgba(0,0,0,0.3)',
          }}
        >
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={newSectionTitle}
              onChange={e => setNewSectionTitle(e.target.value)}
              onKeyDown={e => {
                if (e.nativeEvent.isComposing) return
                if (e.key === 'Enter') { addSection(e as unknown as React.FormEvent); }
                if (e.key === 'Escape') { setAddingSectionTitle(false); setNewSectionTitle('') }
              }}
              placeholder="섹션 이름..."
              className="flex-1 text-[14px] focus:outline-none rounded-xl px-3 py-2.5"
              style={{ background: 'var(--bg-input)', border: '1px solid var(--accent-dim)', color: 'var(--text)' }}
              autoFocus
            />
            <button
              onClick={e => addSection(e as unknown as React.FormEvent)}
              className="p-2.5 rounded-xl flex-shrink-0"
              style={{ background: 'var(--accent-dim)', color: 'var(--accent-light)', border: '1px solid var(--accent)' }}
            >
              <Check size={16} />
            </button>
            <button
              onClick={() => { setAddingSectionTitle(false); setNewSectionTitle('') }}
              className="p-2.5 rounded-xl flex-shrink-0"
              style={{ background: 'var(--bg-card)', color: 'var(--text-dim)', border: '1px solid var(--border)' }}
            >
              <X size={16} />
            </button>
          </div>
        </div>
      )}

      {/* Delete Confirm Modal */}
      {confirmDelete && project && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 backdrop-blur-sm"
            style={{ background: 'rgba(10,8,4,0.7)' }}
            onClick={() => setConfirmDelete(false)}
          />
          <div
            className="relative w-full max-w-sm rounded-2xl p-6 shadow-2xl"
            style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}
          >
            <div
              className="w-10 h-10 rounded-full flex items-center justify-center mb-4"
              style={{ background: 'rgba(239,68,68,0.1)' }}
            >
              <Trash2 size={18} style={{ color: 'var(--danger)' }} />
            </div>
            <h3 className="font-semibold mb-1" style={{ color: 'var(--text-bright)' }}>프로젝트 삭제</h3>
            <p className="text-sm mb-1" style={{ color: 'var(--text-muted)' }}>
              <span style={{ color: 'var(--text-bright)', fontWeight: 600 }}>"{project.name}"</span>을 삭제할까요?
            </p>
            <p className="text-xs mb-6" style={{ color: 'var(--text-dim)' }}>
              프로젝트 내 모든 할일이 함께 삭제되며 복구할 수 없습니다.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setConfirmDelete(false)}
                className="flex-1 py-2 text-sm rounded-xl"
                style={{ background: 'var(--bg-input)', border: '1px solid var(--border)', color: 'var(--text-muted)' }}
              >
                취소
              </button>
              <button
                onClick={deleteProject}
                className="flex-1 py-2 text-sm rounded-xl font-medium"
                style={{ background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.3)', color: 'var(--danger)' }}
              >
                삭제
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
