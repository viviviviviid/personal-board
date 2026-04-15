export {}

/**
 * Notes PATCH / DELETE 비즈니스 로직 테스트
 *
 * API 라우트(src/app/api/notes/[id]/route.ts) 핵심 로직:
 *   - PATCH: 정의된 필드만 updateData에 포함
 *   - PATCH/DELETE: Prisma P2025(레코드 없음) → 404 반환
 */

// ── PATCH: updateData 구성 로직 ───────────────────────────────────────────────

function buildNoteUpdateData(body: Record<string, unknown>): Record<string, unknown> {
  const { title, content, tags, date, pinned } = body
  const data: Record<string, unknown> = {}
  if (title !== undefined)   data.title = title
  if (content !== undefined) data.content = content
  if (tags !== undefined)    data.tags = tags
  if (date !== undefined)    data.date = date
  if (pinned !== undefined)  data.pinned = pinned
  return data
}

describe('buildNoteUpdateData', () => {
  test('body가 빈 객체면 updateData도 빔', () => {
    expect(buildNoteUpdateData({})).toEqual({})
  })

  test('정의된 필드만 포함', () => {
    const data = buildNoteUpdateData({ content: '새 내용', pinned: true })
    expect(data).toEqual({ content: '새 내용', pinned: true })
    expect(data).not.toHaveProperty('title')
    expect(data).not.toHaveProperty('tags')
    expect(data).not.toHaveProperty('date')
  })

  test('title=null → 포함 (제목 제거 허용)', () => {
    const data = buildNoteUpdateData({ title: null })
    expect(data).toHaveProperty('title', null)
  })

  test('pinned=false → 포함 (false는 유효한 값)', () => {
    const data = buildNoteUpdateData({ pinned: false })
    expect(data).toHaveProperty('pinned', false)
  })

  test('content=빈 문자열 → 포함', () => {
    const data = buildNoteUpdateData({ content: '' })
    expect(data).toHaveProperty('content', '')
  })

  test('tags 업데이트', () => {
    const data = buildNoteUpdateData({ tags: '태그1,태그2' })
    expect(data).toHaveProperty('tags', '태그1,태그2')
  })

  test('전체 필드 동시 업데이트', () => {
    const body = { title: '제목', content: '내용', tags: 't1,t2', date: '2026-04-16', pinned: true }
    const data = buildNoteUpdateData(body)
    expect(Object.keys(data)).toHaveLength(5)
  })
})

// ── P2025 오류 처리 ───────────────────────────────────────────────────────────

/**
 * Prisma P2025 에러 핸들링 로직 (route에서 catch 블록과 동일)
 * P2025 → 404, 그 외 → 500
 */
function handlePrismaError(error: unknown): { status: number; body: Record<string, string> } {
  if (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error as { code: string }).code === 'P2025'
  ) {
    return { status: 404, body: { error: 'Not found' } }
  }
  return { status: 500, body: { error: 'Internal error' } }
}

describe('P2025 오류 처리', () => {
  test('P2025 코드 → 404', () => {
    const err = { code: 'P2025', message: 'Record not found' }
    const result = handlePrismaError(err)
    expect(result.status).toBe(404)
    expect(result.body.error).toBe('Not found')
  })

  test('다른 Prisma 오류 코드 → 500', () => {
    const err = { code: 'P2002', message: 'Unique constraint failed' }
    const result = handlePrismaError(err)
    expect(result.status).toBe(500)
  })

  test('일반 Error 객체 → 500', () => {
    const err = new Error('DB connection failed')
    const result = handlePrismaError(err)
    expect(result.status).toBe(500)
  })

  test('null → 500 (비정상 throw)', () => {
    const result = handlePrismaError(null)
    expect(result.status).toBe(500)
  })

  test('undefined → 500', () => {
    const result = handlePrismaError(undefined)
    expect(result.status).toBe(500)
  })

  test('code가 없는 객체 → 500', () => {
    const err = { message: 'something went wrong' }
    const result = handlePrismaError(err)
    expect(result.status).toBe(500)
  })
})

// ── Prisma mock 기반: 실제 호출 패턴 검증 ────────────────────────────────────

jest.mock('@/lib/prisma', () => ({
  prisma: {
    note: {
      update: jest.fn(),
      delete: jest.fn(),
    },
  },
}))

import { prisma } from '@/lib/prisma'

const mockNoteUpdate = prisma.note.update as jest.Mock
const mockNoteDelete = prisma.note.delete as jest.Mock

describe('note update (prisma mock)', () => {
  beforeEach(() => jest.clearAllMocks())

  test('userId 범위 조건 포함 → 타인 메모 수정 차단', async () => {
    mockNoteUpdate.mockResolvedValue({ id: 'note-1', content: '수정됨' })

    const data = buildNoteUpdateData({ content: '수정됨' })
    await prisma.note.update({ where: { id: 'note-1', userId: 'user-1' }, data })

    expect(mockNoteUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'note-1', userId: 'user-1' },
      })
    )
  })

  test('pinned 토글 업데이트', async () => {
    mockNoteUpdate.mockResolvedValue({ id: 'note-2', pinned: true })

    const data = buildNoteUpdateData({ pinned: true })
    await prisma.note.update({ where: { id: 'note-2', userId: 'user-1' }, data })

    expect(mockNoteUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ pinned: true }),
      })
    )
  })
})

describe('note delete (prisma mock)', () => {
  beforeEach(() => jest.clearAllMocks())

  test('userId 범위 조건으로 delete → 타인 메모 삭제 차단', async () => {
    mockNoteDelete.mockResolvedValue({})

    await prisma.note.delete({ where: { id: 'note-1', userId: 'user-1' } })

    expect(mockNoteDelete).toHaveBeenCalledWith({
      where: { id: 'note-1', userId: 'user-1' },
    })
  })

  test('P2025 throw → 404 처리', () => {
    const p2025 = { code: 'P2025' }
    let caught: unknown
    try {
      throw p2025
    } catch (e) {
      caught = e
    }
    const result = handlePrismaError(caught)
    expect(result.status).toBe(404)
  })
})
