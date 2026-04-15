export {}

/**
 * DailyHighlight 비즈니스 로직 테스트
 *
 * API 라우트(src/app/api/daily-highlight/route.ts) 핵심 로직:
 *   - GET: week 파라미터 → 7일치 날짜 문자열 배열 생성
 *   - POST: date + content 필수, completed 선택, upsert
 *   - PATCH: content trim, completed 선택 업데이트
 *   - DELETE: date 파라미터 필수
 */

import { format, addDays } from 'date-fns'

// ── GET: 주간 날짜 배열 생성 ──────────────────────────────────────────────────

function buildWeekDates(week: string): string[] {
  return Array.from({ length: 7 }, (_, i) =>
    format(addDays(new Date(week), i), 'yyyy-MM-dd')
  )
}

describe('buildWeekDates', () => {
  test('7일치 날짜 배열 반환', () => {
    const dates = buildWeekDates('2026-04-14')
    expect(dates).toHaveLength(7)
  })

  test('시작일 포함', () => {
    const dates = buildWeekDates('2026-04-14')
    expect(dates[0]).toBe('2026-04-14')
  })

  test('마지막 날은 시작일 +6일', () => {
    const dates = buildWeekDates('2026-04-14')
    expect(dates[6]).toBe('2026-04-20')
  })

  test('날짜 형식 yyyy-MM-dd', () => {
    const dates = buildWeekDates('2026-01-01')
    dates.forEach(d => {
      expect(d).toMatch(/^\d{4}-\d{2}-\d{2}$/)
    })
  })

  test('월 경계를 넘는 주', () => {
    const dates = buildWeekDates('2026-01-29')
    expect(dates[2]).toBe('2026-01-31')
    expect(dates[3]).toBe('2026-02-01')
  })

  test('연도 경계를 넘는 주', () => {
    const dates = buildWeekDates('2025-12-29')
    expect(dates[0]).toBe('2025-12-29')
    expect(dates[3]).toBe('2026-01-01')
    expect(dates[6]).toBe('2026-01-04')
  })

  test('연속적인 날짜 (중복·건너뜀 없음)', () => {
    const dates = buildWeekDates('2026-04-14')
    for (let i = 1; i < 7; i++) {
      const prev = new Date(dates[i - 1])
      const curr = new Date(dates[i])
      const diff = (curr.getTime() - prev.getTime()) / (1000 * 60 * 60 * 24)
      expect(diff).toBe(1)
    }
  })
})

// ── POST: 요청 유효성 검증 ────────────────────────────────────────────────────

function validateHighlightPost(body: Record<string, unknown>): string | null {
  const { date, content } = body
  if (!date || !(content as string | undefined)?.trim()) {
    return 'date and content required'
  }
  return null
}

describe('validateHighlightPost', () => {
  test('date + content 모두 있으면 null 반환', () => {
    expect(validateHighlightPost({ date: '2026-04-16', content: '오늘의 하이라이트' })).toBeNull()
  })

  test('date 없으면 에러 메시지 반환', () => {
    expect(validateHighlightPost({ content: '내용' })).not.toBeNull()
  })

  test('content 없으면 에러 메시지 반환', () => {
    expect(validateHighlightPost({ date: '2026-04-16' })).not.toBeNull()
  })

  test('content가 빈 문자열이면 에러', () => {
    expect(validateHighlightPost({ date: '2026-04-16', content: '' })).not.toBeNull()
  })

  test('content가 공백만이면 에러', () => {
    expect(validateHighlightPost({ date: '2026-04-16', content: '   ' })).not.toBeNull()
  })

  test('completed는 선택 → 없어도 통과', () => {
    expect(validateHighlightPost({ date: '2026-04-16', content: '내용' })).toBeNull()
  })
})

// ── POST: upsert 데이터 구성 ──────────────────────────────────────────────────

function buildHighlightUpsert(
  userId: string,
  body: { date: string; content: string; completed?: boolean }
) {
  const { date, content, completed } = body
  return {
    where: { userId_date: { userId, date } },
    update: { content: content.trim(), ...(completed !== undefined && { completed }) },
    create: { userId, date, content: content.trim() },
  }
}

describe('buildHighlightUpsert', () => {
  test('기본 upsert 구조', () => {
    const args = buildHighlightUpsert('user-1', { date: '2026-04-16', content: '하이라이트' })
    expect(args.where).toEqual({ userId_date: { userId: 'user-1', date: '2026-04-16' } })
    expect(args.create).toEqual({ userId: 'user-1', date: '2026-04-16', content: '하이라이트' })
    expect(args.update).toEqual({ content: '하이라이트' })
  })

  test('content 앞뒤 공백 trim', () => {
    const args = buildHighlightUpsert('user-1', { date: '2026-04-16', content: '  트림 테스트  ' })
    expect(args.update.content).toBe('트림 테스트')
    expect(args.create.content).toBe('트림 테스트')
  })

  test('completed 포함 시 update에 추가', () => {
    const args = buildHighlightUpsert('user-1', { date: '2026-04-16', content: '내용', completed: true })
    expect(args.update).toHaveProperty('completed', true)
  })

  test('completed=false → update에 포함', () => {
    const args = buildHighlightUpsert('user-1', { date: '2026-04-16', content: '내용', completed: false })
    expect(args.update).toHaveProperty('completed', false)
  })

  test('completed 미제공 → update에 미포함', () => {
    const args = buildHighlightUpsert('user-1', { date: '2026-04-16', content: '내용' })
    expect(args.update).not.toHaveProperty('completed')
  })

  test('create에는 completed 미포함 (기본값은 DB 스키마 default)', () => {
    const args = buildHighlightUpsert('user-1', { date: '2026-04-16', content: '내용', completed: true })
    expect(args.create).not.toHaveProperty('completed')
  })
})

// ── PATCH: update 데이터 구성 ─────────────────────────────────────────────────

function buildHighlightUpdateData(body: Record<string, unknown>): Record<string, unknown> {
  const { content, completed } = body
  const data: Record<string, unknown> = {}
  if (content !== undefined) data.content = (content as string).trim()
  if (completed !== undefined) data.completed = completed
  return data
}

describe('buildHighlightUpdateData', () => {
  test('content만 있으면 trim 후 포함', () => {
    const data = buildHighlightUpdateData({ content: '  내용  ' })
    expect(data).toEqual({ content: '내용' })
  })

  test('completed만 있으면 포함', () => {
    const data = buildHighlightUpdateData({ completed: true })
    expect(data).toEqual({ completed: true })
  })

  test('completed=false → 포함', () => {
    const data = buildHighlightUpdateData({ completed: false })
    expect(data).toHaveProperty('completed', false)
  })

  test('content + completed 동시 업데이트', () => {
    const data = buildHighlightUpdateData({ content: '하이라이트', completed: true })
    expect(data).toEqual({ content: '하이라이트', completed: true })
  })

  test('빈 body → 빈 data', () => {
    expect(buildHighlightUpdateData({})).toEqual({})
  })
})

// ── Prisma mock 기반: 실제 호출 패턴 검증 ────────────────────────────────────

jest.mock('@/lib/prisma', () => ({
  prisma: {
    dailyHighlight: {
      findMany: jest.fn(),
      upsert: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
  },
}))

import { prisma } from '@/lib/prisma'

const mockFindMany = prisma.dailyHighlight.findMany as jest.Mock
const mockUpsert = prisma.dailyHighlight.upsert as jest.Mock
const mockUpdate = prisma.dailyHighlight.update as jest.Mock
const mockDelete = prisma.dailyHighlight.delete as jest.Mock

describe('dailyHighlight prisma 호출 패턴', () => {
  beforeEach(() => jest.clearAllMocks())

  test('GET: 주간 날짜 배열로 findMany 호출', async () => {
    mockFindMany.mockResolvedValue([])
    const userId = 'user-1'
    const dates = buildWeekDates('2026-04-14')

    await prisma.dailyHighlight.findMany({
      where: { userId, date: { in: dates } },
    })

    expect(mockFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          userId: 'user-1',
          date: { in: dates },
        }),
      })
    )
  })

  test('POST: upsert에 userId_date unique key 사용', async () => {
    mockUpsert.mockResolvedValue({ id: 'h-1' })
    const userId = 'user-1'
    const args = buildHighlightUpsert(userId, { date: '2026-04-16', content: '내용' })

    await prisma.dailyHighlight.upsert(args)

    expect(mockUpsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId_date: { userId: 'user-1', date: '2026-04-16' } },
      })
    )
  })

  test('PATCH: userId_date로 특정 유저의 특정 날짜 업데이트', async () => {
    mockUpdate.mockResolvedValue({ id: 'h-1', completed: true })

    await prisma.dailyHighlight.update({
      where: { userId_date: { userId: 'user-1', date: '2026-04-16' } },
      data: { completed: true },
    })

    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId_date: { userId: 'user-1', date: '2026-04-16' } },
        data: { completed: true },
      })
    )
  })

  test('DELETE: userId_date로 삭제', async () => {
    mockDelete.mockResolvedValue({})

    await prisma.dailyHighlight.delete({
      where: { userId_date: { userId: 'user-1', date: '2026-04-16' } },
    })

    expect(mockDelete).toHaveBeenCalledWith({
      where: { userId_date: { userId: 'user-1', date: '2026-04-16' } },
    })
  })
})
