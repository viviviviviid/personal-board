'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { Plus, X, ChevronRight, FolderKanban, Target, Trash2 } from 'lucide-react'

interface Project {
  id: string
  name: string
  description: string | null
  color: string
  goal: string | null
  totalTodos: number
  completedTodos: number
}

const COLOR_OPTIONS = [
  '#c78928', '#95a586', '#688ac4', '#c47858',
  '#a858c4', '#58c4a8', '#c45878', '#c47040',
  '#6888c4', '#58b4c4',
]

export default function ProjectsPage() {
  const [projects, setProjects] = useState<Project[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [formData, setFormData] = useState({ name: '', description: '', color: '#c78928', goal: '' })
  const [creating, setCreating] = useState(false)
  const [createError, setCreateError] = useState<string | null>(null)
  const [confirmDelete, setConfirmDelete] = useState<{ id: string; name: string } | null>(null)

  const fetchProjects = async () => {
    try {
      const res = await fetch('/api/projects')
      if (!res.ok) throw new Error('Failed')
      setProjects(await res.json())
      setError(null)
    } catch {
      setError('프로젝트 데이터를 불러올 수 없습니다.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchProjects() }, [])

  const createProject = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!formData.name.trim()) return
    setCreating(true)
    setCreateError(null)
    try {
      const res = await fetch('/api/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        if (data.code === 'UPGRADE_REQUIRED') {
          setCreateError('프리 플랜은 최대 3개까지 생성할 수 있습니다.')
        } else {
          setCreateError(data.error || '프로젝트 생성에 실패했습니다.')
        }
        return
      }
      setShowCreateModal(false)
      setFormData({ name: '', description: '', color: '#c78928', goal: '' })
      fetchProjects()
    } catch {
      setCreateError('네트워크 오류가 발생했습니다.')
    } finally {
      setCreating(false)
    }
  }

  const deleteProject = async (projectId: string) => {
    setProjects((prev) => prev.filter((p) => p.id !== projectId))
    setConfirmDelete(null)
    try {
      await fetch(`/api/projects/${projectId}`, { method: 'DELETE' })
    } catch {
      fetchProjects()
    }
  }

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl font-bold" style={{ color: 'var(--text-bright)' }}>프로젝트</h2>
          <p className="text-sm mt-0.5" style={{ color: 'var(--text-muted)' }}>{projects.length}개 프로젝트</p>
        </div>
        <button
          onClick={() => { if (!showCreateModal) setShowCreateModal(true) }}
          disabled={showCreateModal}
          className="flex items-center gap-1.5 px-3 py-2 text-sm rounded-lg transition-all"
          style={{ background: 'var(--accent-dim)', border: '1px solid var(--accent)', color: 'var(--accent-light)' }}
        >
          <Plus size={15} />
          <span className="hidden sm:inline">새 프로젝트</span>
        </button>
      </div>

      {error && (
        <div
          className="mb-4 p-3 rounded-xl text-sm"
          style={{ background: 'rgba(168,88,72,0.1)', border: '1px solid rgba(168,88,72,0.3)', color: 'var(--danger)' }}
        >
          {error}
        </div>
      )}

      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="rounded-xl h-40 animate-pulse"
              style={{ background: 'var(--bg-card)', border: '1px solid var(--border-dim)' }}
            />
          ))}
        </div>
      ) : projects.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <FolderKanban size={48} className="mb-4" style={{ color: 'var(--border)' }} />
          <h3 className="text-lg font-medium mb-2" style={{ color: 'var(--text-muted)' }}>프로젝트가 없습니다</h3>
          <p className="text-sm mb-6" style={{ color: 'var(--text-dim)' }}>새 프로젝트를 만들어 할일을 관리해 보세요</p>
          <button
            onClick={() => setShowCreateModal(true)}
            className="flex items-center gap-2 px-4 py-2 text-sm rounded-lg"
            style={{ background: 'var(--accent-dim)', border: '1px solid var(--accent)', color: 'var(--accent-light)' }}
          >
            <Plus size={16} />프로젝트 만들기
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
          {projects.map((project) => {
            const progress = project.totalTodos > 0
              ? Math.round((project.completedTodos / project.totalTodos) * 100)
              : 0

            return (
              <Link
                key={project.id}
                href={`/projects/${project.id}`}
                className="block rounded-xl p-4 transition-all group relative overflow-hidden"
                style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}
                onMouseEnter={e => (e.currentTarget.style.borderColor = project.color + '60')}
                onMouseLeave={e => (e.currentTarget.style.borderColor = 'var(--border)')}
              >
                {/* Color accent bar */}
                <div
                  className="absolute left-0 top-0 bottom-0 w-1 rounded-l-xl"
                  style={{ backgroundColor: project.color }}
                />

                <div className="pl-2">
                  <div className="flex items-start justify-between mb-2">
                    <h3 className="font-semibold" style={{ color: 'var(--text-bright)' }}>
                      {project.name}
                    </h3>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={(e) => { e.preventDefault(); e.stopPropagation(); setConfirmDelete({ id: project.id, name: project.name }) }}
                        className="opacity-0 group-hover:opacity-100 p-1 rounded transition-all"
                        style={{ color: 'var(--text-dim)' }}
                        onMouseEnter={e => (e.currentTarget.style.color = 'var(--danger)')}
                        onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-dim)')}
                      >
                        <Trash2 size={14} />
                      </button>
                      <ChevronRight size={16} style={{ color: 'var(--text-dim)' }} />
                    </div>
                  </div>

                  {project.description && (
                    <p className="text-xs mb-3 line-clamp-2" style={{ color: 'var(--text-muted)' }}>
                      {project.description}
                    </p>
                  )}

                  {project.goal && (
                    <div
                      className="flex items-start gap-1.5 mb-3 p-2 rounded-lg"
                      style={{ background: 'var(--bg-input)' }}
                    >
                      <Target size={12} className="mt-0.5 flex-shrink-0" style={{ color: 'var(--accent)' }} />
                      <p className="text-xs line-clamp-2" style={{ color: 'var(--text-muted)' }}>{project.goal}</p>
                    </div>
                  )}

                  <div className="mt-auto">
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-xs" style={{ color: 'var(--text-dim)' }}>
                        {project.completedTodos}/{project.totalTodos} 완료
                      </span>
                      <span className="text-xs" style={{ color: 'var(--text-dim)' }}>{progress}%</span>
                    </div>
                    <div className="w-full rounded-full h-1.5" style={{ background: 'var(--bg-input)' }}>
                      <div
                        className="h-1.5 rounded-full transition-all"
                        style={{ width: `${progress}%`, backgroundColor: project.color }}
                      />
                    </div>
                  </div>
                </div>
              </Link>
            )
          })}
        </div>
      )}

      {/* Delete Confirm Modal */}
      {confirmDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 backdrop-blur-sm"
            style={{ background: 'rgba(10,8,4,0.7)' }}
            onClick={() => setConfirmDelete(null)}
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
              <span style={{ color: 'var(--text-bright)', fontWeight: 600 }}>"{confirmDelete.name}"</span>을 삭제할까요?
            </p>
            <p className="text-xs mb-6" style={{ color: 'var(--text-dim)' }}>
              프로젝트 내 모든 할일이 함께 삭제되며 복구할 수 없습니다.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setConfirmDelete(null)}
                className="flex-1 py-2 text-sm rounded-xl"
                style={{ background: 'var(--bg-input)', border: '1px solid var(--border)', color: 'var(--text-muted)' }}
              >
                취소
              </button>
              <button
                onClick={() => deleteProject(confirmDelete.id)}
                className="flex-1 py-2 text-sm rounded-xl font-medium"
                style={{ background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.3)', color: 'var(--danger)' }}
              >
                삭제
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Create Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 backdrop-blur-sm"
            style={{ background: 'rgba(10,8,4,0.7)' }}
            onClick={() => setShowCreateModal(false)}
          />
          <div
            className="relative w-full max-w-md shadow-2xl rounded-2xl overflow-hidden"
            style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}
          >
            <div
              className="flex items-center justify-between px-5 py-4"
              style={{ borderBottom: '1px solid var(--border-dim)' }}
            >
              <h2 className="text-base font-semibold" style={{ color: 'var(--text-bright)' }}>새 프로젝트</h2>
              <button
                onClick={() => { setShowCreateModal(false); setCreateError(null) }}
                className="p-1 rounded-lg"
                style={{ color: 'var(--text-dim)' }}
              >
                <X size={16} />
              </button>
            </div>

            <form onSubmit={createProject} className="p-5 space-y-4">
              {createError && (
                <div className="p-3 rounded-lg text-sm" style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', color: 'var(--danger)' }}>
                  {createError}
                </div>
              )}
              {[
                { label: '프로젝트 이름 *', key: 'name', placeholder: '프로젝트 이름을 입력하세요', type: 'input' },
                { label: '설명 (선택)', key: 'description', placeholder: '프로젝트 설명...', type: 'textarea' },
                { label: '목표 (선택)', key: 'goal', placeholder: '이 프로젝트의 목표는...', type: 'textarea' },
              ].map(({ label, key, placeholder, type }) => (
                <div key={key}>
                  <label className="block text-xs mb-1.5" style={{ color: 'var(--text-dim)' }}>{label}</label>
                  {type === 'input' ? (
                    <input
                      type="text"
                      value={formData[key as keyof typeof formData]}
                      onChange={(e) => setFormData((f) => ({ ...f, [key]: e.target.value }))}
                      placeholder={placeholder}
                      className="w-full rounded-lg px-3 py-2 text-sm focus:outline-none"
                      style={{ background: 'var(--bg-input)', border: '1px solid var(--border)', color: 'var(--text)' }}
                      autoFocus={key === 'name'}
                    />
                  ) : (
                    <textarea
                      value={formData[key as keyof typeof formData]}
                      onChange={(e) => setFormData((f) => ({ ...f, [key]: e.target.value }))}
                      placeholder={placeholder}
                      rows={2}
                      className="w-full rounded-lg px-3 py-2 text-sm focus:outline-none resize-none"
                      style={{ background: 'var(--bg-input)', border: '1px solid var(--border)', color: 'var(--text)' }}
                    />
                  )}
                </div>
              ))}

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="flex-1 px-4 py-2 text-sm rounded-lg"
                  style={{ background: 'var(--bg-input)', border: '1px solid var(--border)', color: 'var(--text-muted)' }}
                >
                  취소
                </button>
                <button
                  type="submit"
                  disabled={creating || !formData.name.trim()}
                  className="flex-1 px-4 py-2 text-sm rounded-lg disabled:opacity-50"
                  style={{ background: 'var(--accent-dim)', border: '1px solid var(--accent)', color: 'var(--accent-light)' }}
                >
                  {creating ? '생성 중...' : '만들기'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
