'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { Plus, X, ChevronRight, FolderKanban, Target } from 'lucide-react'

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
  '#6366f1', '#8b5cf6', '#ec4899', '#ef4444',
  '#f97316', '#eab308', '#22c55e', '#14b8a6',
  '#3b82f6', '#06b6d4',
]

export default function ProjectsPage() {
  const [projects, setProjects] = useState<Project[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    color: '#6366f1',
    goal: '',
  })
  const [creating, setCreating] = useState(false)

  const fetchProjects = async () => {
    try {
      const res = await fetch('/api/projects')
      if (!res.ok) throw new Error('Failed')
      const data = await res.json()
      setProjects(data)
      setError(null)
    } catch {
      setError('프로젝트 데이터를 불러올 수 없습니다.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchProjects()
  }, [])

  const createProject = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!formData.name.trim()) return
    setCreating(true)

    try {
      const res = await fetch('/api/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      })
      if (!res.ok) throw new Error('Failed')
      setShowCreateModal(false)
      setFormData({ name: '', description: '', color: '#6366f1', goal: '' })
      fetchProjects()
    } catch {
      // silent fail
    } finally {
      setCreating(false)
    }
  }

  const deleteProject = async (projectId: string, e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (!confirm('프로젝트를 삭제하시겠습니까? 모든 할일도 함께 삭제됩니다.')) return

    setProjects((prev) => prev.filter((p) => p.id !== projectId))
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
          <h2 className="text-xl font-bold text-gray-100">프로젝트</h2>
          <p className="text-sm text-gray-500 mt-0.5">
            {projects.length}개 프로젝트
          </p>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-sm rounded-lg transition-colors"
        >
          <Plus size={16} />
          새 프로젝트
        </button>
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-sm text-red-400">
          {error}
        </div>
      )}

      {loading ? (
        <div className="grid grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="bg-[#1a1a24] border border-[#2a2a3a] rounded-xl h-40 animate-pulse" />
          ))}
        </div>
      ) : projects.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <FolderKanban size={48} className="text-gray-700 mb-4" />
          <h3 className="text-lg font-medium text-gray-400 mb-2">프로젝트가 없습니다</h3>
          <p className="text-sm text-gray-600 mb-6">새 프로젝트를 만들어 할일을 관리해 보세요</p>
          <button
            onClick={() => setShowCreateModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-sm rounded-lg transition-colors"
          >
            <Plus size={16} />
            프로젝트 만들기
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-3 gap-4">
          {projects.map((project) => {
            const progress =
              project.totalTodos > 0
                ? Math.round((project.completedTodos / project.totalTodos) * 100)
                : 0

            return (
              <Link
                key={project.id}
                href={`/projects/${project.id}`}
                className="block bg-[#1a1a24] border border-[#2a2a3a] rounded-xl p-4 hover:border-indigo-500/30 transition-all group relative overflow-hidden"
              >
                {/* Color accent bar */}
                <div
                  className="absolute left-0 top-0 bottom-0 w-1 rounded-l-xl"
                  style={{ backgroundColor: project.color }}
                />

                <div className="pl-2">
                  <div className="flex items-start justify-between mb-2">
                    <h3 className="font-semibold text-gray-200 group-hover:text-white transition-colors">
                      {project.name}
                    </h3>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={(e) => deleteProject(project.id, e)}
                        className="opacity-0 group-hover:opacity-100 p-1 hover:bg-red-500/10 text-gray-600 hover:text-red-400 rounded transition-all"
                      >
                        <X size={14} />
                      </button>
                      <ChevronRight size={16} className="text-gray-600 group-hover:text-gray-400 transition-colors" />
                    </div>
                  </div>

                  {project.description && (
                    <p className="text-xs text-gray-500 mb-3 line-clamp-2">{project.description}</p>
                  )}

                  {project.goal && (
                    <div className="flex items-start gap-1.5 mb-3 p-2 bg-[#22222f] rounded-lg">
                      <Target size={12} className="text-indigo-400 mt-0.5 flex-shrink-0" />
                      <p className="text-xs text-gray-400 line-clamp-2">{project.goal}</p>
                    </div>
                  )}

                  <div className="mt-auto">
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-xs text-gray-600">
                        {project.completedTodos}/{project.totalTodos} 완료
                      </span>
                      <span className="text-xs text-gray-600">{progress}%</span>
                    </div>
                    <div className="w-full bg-[#22222f] rounded-full h-1.5">
                      <div
                        className="h-1.5 rounded-full transition-all"
                        style={{
                          width: `${progress}%`,
                          backgroundColor: project.color,
                        }}
                      />
                    </div>
                  </div>
                </div>
              </Link>
            )
          })}
        </div>
      )}

      {/* Create Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => setShowCreateModal(false)}
          />
          <div className="relative bg-[#1a1a24] border border-[#2a2a3a] rounded-2xl w-full max-w-md shadow-2xl">
            <div className="flex items-center justify-between px-5 py-4 border-b border-[#2a2a3a]">
              <h2 className="text-base font-semibold text-gray-200">새 프로젝트</h2>
              <button
                onClick={() => setShowCreateModal(false)}
                className="p-1 hover:bg-[#22222f] rounded-lg text-gray-500 hover:text-gray-300 transition-colors"
              >
                <X size={16} />
              </button>
            </div>

            <form onSubmit={createProject} className="p-5 space-y-4">
              <div>
                <label className="block text-xs text-gray-500 mb-1.5">프로젝트 이름 *</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData((f) => ({ ...f, name: e.target.value }))}
                  placeholder="프로젝트 이름을 입력하세요"
                  className="w-full bg-[#22222f] border border-[#2a2a3a] rounded-lg px-3 py-2 text-sm text-gray-200 placeholder-gray-600 focus:outline-none focus:border-indigo-500/50"
                  autoFocus
                />
              </div>

              <div>
                <label className="block text-xs text-gray-500 mb-1.5">설명 (선택)</label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData((f) => ({ ...f, description: e.target.value }))}
                  placeholder="프로젝트 설명..."
                  rows={2}
                  className="w-full bg-[#22222f] border border-[#2a2a3a] rounded-lg px-3 py-2 text-sm text-gray-200 placeholder-gray-600 focus:outline-none focus:border-indigo-500/50 resize-none"
                />
              </div>

              <div>
                <label className="block text-xs text-gray-500 mb-1.5">목표 (선택)</label>
                <textarea
                  value={formData.goal}
                  onChange={(e) => setFormData((f) => ({ ...f, goal: e.target.value }))}
                  placeholder="이 프로젝트의 목표는..."
                  rows={2}
                  className="w-full bg-[#22222f] border border-[#2a2a3a] rounded-lg px-3 py-2 text-sm text-gray-200 placeholder-gray-600 focus:outline-none focus:border-indigo-500/50 resize-none"
                />
              </div>

              <div>
                <label className="block text-xs text-gray-500 mb-2">컬러</label>
                <div className="flex gap-2 flex-wrap">
                  {COLOR_OPTIONS.map((color) => (
                    <button
                      key={color}
                      type="button"
                      onClick={() => setFormData((f) => ({ ...f, color }))}
                      className={`w-7 h-7 rounded-full transition-all ${
                        formData.color === color ? 'ring-2 ring-white ring-offset-2 ring-offset-[#22222f] scale-110' : ''
                      }`}
                      style={{ backgroundColor: color }}
                    />
                  ))}
                </div>
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="flex-1 px-4 py-2 bg-[#22222f] border border-[#2a2a3a] hover:border-gray-600 text-gray-400 text-sm rounded-lg transition-colors"
                >
                  취소
                </button>
                <button
                  type="submit"
                  disabled={creating || !formData.name.trim()}
                  className="flex-1 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-sm rounded-lg transition-colors disabled:opacity-50"
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
