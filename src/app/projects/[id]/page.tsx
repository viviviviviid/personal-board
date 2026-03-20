'use client'

import { useState, useEffect, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { ChevronLeft, ChevronDown, ChevronRight, Plus, Check, X, Target, Trash2 } from 'lucide-react'

interface Todo {
  id: string
  title: string
  completed: boolean
  priority: string
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

export default function ProjectDetailPage() {
  const params = useParams()
  const router = useRouter()
  const projectId = params.id as string

  const [project, setProject] = useState<Project | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [openSections, setOpenSections] = useState<Set<string>>(new Set())
  const [addingFor, setAddingFor] = useState<string>(CLOSED)
  const [newTodoTitle, setNewTodoTitle] = useState('')
  const [addingSectionTitle, setAddingSectionTitle] = useState(false)
  const [newSectionTitle, setNewSectionTitle] = useState('')

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
    setOpenSections((prev) => {
      const next = new Set(prev)
      next.has(sectionId) ? next.delete(sectionId) : next.add(sectionId)
      return next
    })
  }

  const toggleTodo = async (todoId: string, currentCompleted: boolean) => {
    if (!project) return
    const update = (t: Todo) => t.id === todoId ? { ...t, completed: !currentCompleted } : t
    setProject((p) => p ? {
      ...p,
      todos: p.todos.map(update),
      sections: p.sections.map((s) => ({ ...s, todos: s.todos.map(update) })),
    } : p)
    try {
      await fetch(`/api/todos/${todoId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ completed: !currentCompleted }),
      })
    } catch {
      fetchProject()
    }
  }

  const deleteTodo = async (todoId: string) => {
    if (!project) return
    setProject((p) => p ? {
      ...p,
      todos: p.todos.filter((t) => t.id !== todoId),
      sections: p.sections.map((s) => ({ ...s, todos: s.todos.filter((t) => t.id !== todoId) })),
    } : p)
    try {
      await fetch(`/api/todos/${todoId}`, { method: 'DELETE' })
    } catch {
      fetchProject()
    }
  }

  const addTodo = async (key: string) => {
    if (!newTodoTitle.trim() || !project) return
    const actualSectionId = key === UNSECTIONED ? null : key
    const tempId = `temp-${Date.now()}`
    const newTodo: Todo = { id: tempId, title: newTodoTitle.trim(), completed: false, priority: 'medium', sectionId: actualSectionId }

    setProject((p) => p
      ? actualSectionId
        ? { ...p, sections: p.sections.map((s) => s.id === actualSectionId ? { ...s, todos: [...s.todos, newTodo] } : s) }
        : { ...p, todos: [...p.todos, newTodo] }
      : p
    )
    setNewTodoTitle('')
    setAddingFor(CLOSED)

    try {
      const res = await fetch('/api/todos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: newTodo.title, projectId: project.id, sectionId: actualSectionId }),
      })
      if (!res.ok) throw new Error('Failed')
      const created = await res.json()
      setProject((p) => p ? {
        ...p,
        todos: p.todos.map((t) => (t.id === tempId ? created : t)),
        sections: p.sections.map((s) => ({ ...s, todos: s.todos.map((t) => (t.id === tempId ? created : t)) })),
      } : p)
    } catch {
      fetchProject()
    }
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
      setProject((p) => (p ? { ...p, sections: [...p.sections, newSection] } : p))
      setOpenSections((prev) => new Set([...prev, newSection.id]))
      setNewSectionTitle('')
      setAddingSectionTitle(false)
    } catch {
      // silent
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <div style={{ color: 'var(--text-dim)' }}>로딩 중...</div>
      </div>
    )
  }

  if (error || !project) {
    return (
      <div className="flex flex-col items-center justify-center py-24">
        <div className="mb-4" style={{ color: 'var(--danger)' }}>{error || '프로젝트를 찾을 수 없습니다.'}</div>
        <Link href="/projects" style={{ color: 'var(--accent)' }} className="text-sm">
          프로젝트 목록으로
        </Link>
      </div>
    )
  }

  const allTodos = [...project.todos, ...project.sections.flatMap((s) => s.todos)]
  const completedCount = allTodos.filter((t) => t.completed).length
  const totalCount = allTodos.length

  const TodoItem = ({ todo }: { todo: Todo }) => (
    <div
      className="flex items-center gap-2 group px-3 py-1.5 rounded-lg transition-all"
      onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-hover)')}
      onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
    >
      <button
        onClick={() => toggleTodo(todo.id, todo.completed)}
        className="w-4 h-4 rounded border flex items-center justify-center flex-shrink-0 transition-all"
        style={{
          background: todo.completed ? 'var(--accent-dim)' : 'transparent',
          borderColor: todo.completed ? 'var(--accent)' : 'var(--border)',
        }}
      >
        {todo.completed && <Check size={10} style={{ color: 'var(--accent-light)' }} />}
      </button>
      {/* Priority dot */}
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
      <button
        onClick={() => deleteTodo(todo.id)}
        className="opacity-0 group-hover:opacity-100 transition-all"
        style={{ color: 'var(--text-dim)' }}
        onMouseEnter={e => (e.currentTarget.style.color = 'var(--danger)')}
        onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-dim)')}
      >
        <Trash2 size={12} />
      </button>
    </div>
  )

  const AddTodoInline = ({ forKey }: { forKey: string }) => {
    const isActive = addingFor === forKey
    if (!isActive) {
      return (
        <button
          onClick={() => { setAddingFor(forKey); setNewTodoTitle('') }}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs w-full transition-colors"
          style={{ color: 'var(--text-dim)' }}
          onMouseEnter={e => (e.currentTarget.style.color = 'var(--accent)')}
          onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-dim)')}
        >
          <Plus size={12} /><span>할일 추가</span>
        </button>
      )
    }
    return (
      <div className="flex items-center gap-2 px-3 py-1.5">
        <div className="w-4 h-4 rounded border flex-shrink-0" style={{ borderColor: 'var(--border)' }} />
        <div className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: PRIORITY_COLOR.medium, opacity: 0.8 }} />
        <input
          type="text"
          value={newTodoTitle}
          onChange={(e) => setNewTodoTitle(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') addTodo(forKey)
            if (e.key === 'Escape') { setAddingFor(CLOSED); setNewTodoTitle('') }
          }}
          placeholder="할일 이름..."
          className="flex-1 bg-transparent py-0.5 text-sm focus:outline-none"
          style={{ borderBottom: '1px solid var(--accent-dim)', color: 'var(--text)' }}
          autoFocus
        />
        <button onClick={() => addTodo(forKey)} style={{ color: 'var(--accent)' }}><Check size={14} /></button>
        <button onClick={() => { setAddingFor(CLOSED); setNewTodoTitle('') }} style={{ color: 'var(--text-dim)' }}><X size={14} /></button>
      </div>
    )
  }

  return (
    <div>
      {/* Header */}
      <div className="mb-6">
        <Link
          href="/projects"
          className="inline-flex items-center gap-1 text-sm mb-4 transition-colors"
          style={{ color: 'var(--text-muted)' }}
          onMouseEnter={e => (e.currentTarget.style.color = 'var(--text-bright)')}
          onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-muted)')}
        >
          <ChevronLeft size={16} />프로젝트 목록
        </Link>

        <div className="flex items-start gap-4">
          <div className="w-1 self-stretch rounded-full flex-shrink-0" style={{ backgroundColor: project.color }} />
          <div className="flex-1">
            <h2 className="text-2xl font-bold" style={{ color: 'var(--text-bright)' }}>{project.name}</h2>
            {project.description && (
              <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>{project.description}</p>
            )}
            {project.goal && (
              <div
                className="mt-3 flex items-start gap-2 p-3 rounded-xl max-w-2xl"
                style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}
              >
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
              <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
                {completedCount}/{totalCount} 완료
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-2xl space-y-4">
        {/* Unsectioned todos */}
        <div
          className="rounded-xl overflow-hidden"
          style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}
        >
          <div className="px-4 py-3" style={{ borderBottom: '1px solid var(--border-dim)' }}>
            <span className="text-sm font-medium" style={{ color: 'var(--text-muted)' }}>기본</span>
          </div>
          <div className="py-1">
            {project.todos.map((todo) => <TodoItem key={todo.id} todo={todo} />)}
            <AddTodoInline forKey={UNSECTIONED} />
          </div>
        </div>

        {/* Sections */}
        {project.sections.map((section) => {
          const isOpen = openSections.has(section.id)
          return (
            <div
              key={section.id}
              className="rounded-xl overflow-hidden"
              style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}
            >
              <button
                onClick={() => toggleSection(section.id)}
                className="w-full flex items-center gap-2 px-4 py-3 transition-colors"
                style={{ borderBottom: '1px solid var(--border-dim)' }}
                onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-hover)')}
                onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
              >
                {isOpen
                  ? <ChevronDown size={16} style={{ color: 'var(--text-dim)' }} />
                  : <ChevronRight size={16} style={{ color: 'var(--text-dim)' }} />
                }
                <span className="text-sm font-medium" style={{ color: 'var(--text)' }}>{section.title}</span>
                <span className="ml-auto text-xs" style={{ color: 'var(--text-dim)' }}>
                  {section.todos.filter((t) => t.completed).length}/{section.todos.length}
                </span>
              </button>
              {isOpen && (
                <div className="py-1">
                  {section.todos.map((todo) => <TodoItem key={todo.id} todo={todo} />)}
                  <AddTodoInline forKey={section.id} />
                </div>
              )}
            </div>
          )
        })}

        {/* Add Section */}
        {addingSectionTitle ? (
          <form onSubmit={addSection} className="flex gap-2">
            <input
              type="text"
              value={newSectionTitle}
              onChange={(e) => setNewSectionTitle(e.target.value)}
              placeholder="섹션 이름..."
              className="flex-1 rounded-xl px-4 py-2.5 text-sm focus:outline-none"
              style={{ background: 'var(--bg-card)', border: '1px solid var(--accent-dim)', color: 'var(--text)' }}
              autoFocus
              onKeyDown={(e) => { if (e.key === 'Escape') { setAddingSectionTitle(false); setNewSectionTitle('') } }}
            />
            <button
              type="submit"
              className="px-4 py-2.5 text-sm rounded-xl"
              style={{ background: 'var(--accent-dim)', border: '1px solid var(--accent)', color: 'var(--accent-light)' }}
            >
              추가
            </button>
            <button
              type="button"
              onClick={() => { setAddingSectionTitle(false); setNewSectionTitle('') }}
              className="px-4 py-2.5 text-sm rounded-xl"
              style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', color: 'var(--text-muted)' }}
            >
              취소
            </button>
          </form>
        ) : (
          <button
            onClick={() => setAddingSectionTitle(true)}
            className="flex items-center gap-2 px-4 py-2.5 w-full text-sm rounded-xl transition-all"
            style={{
              background: 'var(--bg-card)',
              border: '1px dashed var(--border)',
              color: 'var(--text-dim)',
            }}
            onMouseEnter={e => {
              e.currentTarget.style.borderColor = 'var(--accent-dim)'
              e.currentTarget.style.color = 'var(--accent)'
            }}
            onMouseLeave={e => {
              e.currentTarget.style.borderColor = 'var(--border)'
              e.currentTarget.style.color = 'var(--text-dim)'
            }}
          >
            <Plus size={16} />섹션 추가
          </button>
        )}
      </div>
    </div>
  )
}
