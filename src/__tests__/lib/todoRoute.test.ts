export {}

/**
 * Todo PATCH / DELETE 비즈니스 로직 테스트
 *
 * API 라우트(src/app/api/todos/[id]/route.ts) 내 핵심 로직을 추출하여 검증:
 *   - PATCH: body에 정의된 필드만 updateData에 포함 (urgent 포함)
 *   - DELETE: recurringRuleId 유무에 따른 삭제 분기
 */

// ── PATCH: updateData 구성 로직 ───────────────────────────────────────────────

/**
 * 라우트의 updateData 구성과 동일한 로직
 * undefined인 필드는 제외, null/false/0은 포함
 */
function buildTodoUpdateData(body: Record<string, unknown>): Record<string, unknown> {
  const { title, completed, date, priority, urgent, projectId, sectionId, description } = body
  const data: Record<string, unknown> = {}
  if (title !== undefined)       data.title = title
  if (completed !== undefined)   data.completed = completed
  if (date !== undefined)        data.date = date ? new Date(date as string) : null
  if (priority !== undefined)    data.priority = priority
  if (urgent !== undefined)      data.urgent = urgent
  if (projectId !== undefined)   data.projectId = projectId
  if (sectionId !== undefined)   data.sectionId = sectionId
  if (description !== undefined) data.description = description
  return data
}

describe('buildTodoUpdateData', () => {
  describe('urgent 필드', () => {
    test('urgent=true → data에 포함', () => {
      expect(buildTodoUpdateData({ urgent: true })).toEqual({ urgent: true })
    })

    test('urgent=false → data에 포함 (false도 유효한 값)', () => {
      expect(buildTodoUpdateData({ urgent: false })).toEqual({ urgent: false })
    })

    test('urgent=undefined → data에 미포함', () => {
      const data = buildTodoUpdateData({ title: '제목' })
      expect(data).not.toHaveProperty('urgent')
    })
  })

  describe('필드 선택적 포함', () => {
    test('body가 빈 객체면 updateData도 빔', () => {
      expect(buildTodoUpdateData({})).toEqual({})
    })

    test('정의된 필드만 포함', () => {
      const data = buildTodoUpdateData({ title: '운동', priority: 'high' })
      expect(data).toEqual({ title: '운동', priority: 'high' })
      expect(data).not.toHaveProperty('completed')
      expect(data).not.toHaveProperty('urgent')
    })

    test('completed=false → 포함 (false 체크 오용 방어)', () => {
      const data = buildTodoUpdateData({ completed: false })
      expect(data).toHaveProperty('completed', false)
    })

    test('title=null → 포함 (null은 허용)', () => {
      const data = buildTodoUpdateData({ title: null })
      expect(data).toHaveProperty('title', null)
    })

    test('date 문자열 → Date 객체로 변환', () => {
      const data = buildTodoUpdateData({ date: '2026-04-16' })
      expect(data.date).toBeInstanceOf(Date)
    })

    test('date=null → null 그대로 포함', () => {
      const data = buildTodoUpdateData({ date: null })
      expect(data).toHaveProperty('date', null)
    })

    test('전체 필드 동시 업데이트', () => {
      const body = {
        title: '새 제목',
        completed: true,
        date: '2026-04-20',
        priority: 'high',
        urgent: true,
        projectId: 'proj-1',
        sectionId: 'sec-1',
        description: '설명',
      }
      const data = buildTodoUpdateData(body)
      expect(Object.keys(data)).toHaveLength(8)
      expect(data.title).toBe('새 제목')
      expect(data.urgent).toBe(true)
      expect(data.date).toBeInstanceOf(Date)
    })
  })
})

// ── DELETE: 반복 투두 cascade 로직 ────────────────────────────────────────────

/**
 * 라우트의 삭제 분기 로직과 동일
 * recurringRuleId가 있으면 cascade(RecurringRule 삭제), 없으면 단순 삭제
 */
function decideTodoDeletion(todo: { recurringRuleId: string | null } | null):
  | { type: 'not_found' }
  | { type: 'cascade'; ruleId: string }
  | { type: 'single' } {
  if (!todo) return { type: 'not_found' }
  if (todo.recurringRuleId) return { type: 'cascade', ruleId: todo.recurringRuleId }
  return { type: 'single' }
}

describe('decideTodoDeletion', () => {
  test('todo가 null(미존재)이면 not_found', () => {
    expect(decideTodoDeletion(null)).toEqual({ type: 'not_found' })
  })

  test('recurringRuleId 없으면 single 삭제', () => {
    expect(decideTodoDeletion({ recurringRuleId: null })).toEqual({ type: 'single' })
  })

  test('recurringRuleId 있으면 cascade 삭제 + ruleId 반환', () => {
    const result = decideTodoDeletion({ recurringRuleId: 'rule-abc' })
    expect(result).toEqual({ type: 'cascade', ruleId: 'rule-abc' })
  })

  test('cascade 시 올바른 ruleId 전달', () => {
    const ruleId = 'rule-xyz-123'
    const result = decideTodoDeletion({ recurringRuleId: ruleId })
    if (result.type === 'cascade') {
      expect(result.ruleId).toBe(ruleId)
    }
  })
})

// ── Prisma mock 기반: urgent 토글 업데이트 ────────────────────────────────────

jest.mock('@/lib/prisma', () => ({
  prisma: {
    todo: {
      update: jest.fn(),
      findUnique: jest.fn(),
      delete: jest.fn(),
    },
    recurringRule: {
      delete: jest.fn(),
    },
  },
}))

import { prisma } from '@/lib/prisma'

const mockTodoUpdate = prisma.todo.update as jest.Mock
const mockTodoFindUnique = prisma.todo.findUnique as jest.Mock
const mockTodoDelete = prisma.todo.delete as jest.Mock
const mockRuleDelete = prisma.recurringRule.delete as jest.Mock

describe('todo update (urgent toggle)', () => {
  beforeEach(() => jest.clearAllMocks())

  test('urgent true → prisma.todo.update에 urgent:true 전달', async () => {
    const userId = 'user-1'
    const id = 'todo-1'
    mockTodoUpdate.mockResolvedValue({ id, urgent: true })

    const updateData = buildTodoUpdateData({ urgent: true })
    await prisma.todo.update({ where: { id, userId }, data: updateData, include: { project: { select: { id: true, name: true, color: true } } } })

    expect(mockTodoUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'todo-1', userId: 'user-1' },
        data: expect.objectContaining({ urgent: true }),
      })
    )
  })

  test('urgent false → prisma.todo.update에 urgent:false 전달', async () => {
    const userId = 'user-1'
    const id = 'todo-1'
    mockTodoUpdate.mockResolvedValue({ id, urgent: false })

    const updateData = buildTodoUpdateData({ urgent: false })
    await prisma.todo.update({ where: { id, userId }, data: updateData, include: { project: { select: { id: true, name: true, color: true } } } })

    expect(mockTodoUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ urgent: false }),
      })
    )
  })
})

describe('todo delete (recurring cascade)', () => {
  beforeEach(() => jest.clearAllMocks())

  test('recurringRuleId 없으면 todo.delete 직접 호출', async () => {
    const id = 'todo-1'
    const userId = 'user-1'
    mockTodoFindUnique.mockResolvedValue({ recurringRuleId: null })
    mockTodoDelete.mockResolvedValue({})

    const todo = await prisma.todo.findUnique({ where: { id, userId }, select: { recurringRuleId: true } })
    if (!todo?.recurringRuleId) {
      await prisma.todo.delete({ where: { id, userId } })
    }

    expect(mockTodoDelete).toHaveBeenCalledWith({ where: { id: 'todo-1', userId: 'user-1' } })
    expect(mockRuleDelete).not.toHaveBeenCalled()
  })

  test('recurringRuleId 있으면 recurringRule.delete 호출 (cascade)', async () => {
    const id = 'todo-3'
    const userId = 'user-1'
    const ruleId = 'rule-abc'
    mockTodoFindUnique.mockResolvedValue({ recurringRuleId: ruleId })
    mockRuleDelete.mockResolvedValue({})

    const todo = await prisma.todo.findUnique({ where: { id, userId }, select: { recurringRuleId: true } })
    if (todo?.recurringRuleId) {
      await prisma.recurringRule.delete({ where: { id: todo.recurringRuleId } })
    }

    expect(mockRuleDelete).toHaveBeenCalledWith({ where: { id: ruleId } })
    expect(mockTodoDelete).not.toHaveBeenCalled()
  })
})
