/**
 * 타임라인 삭제 모드 비즈니스 로직 테스트
 *
 * API 라우트 대신 순수 로직 함수로 추출해 검증:
 *   - single: 해당 인스턴스만 제거
 *   - future: 이 날짜 이후 인스턴스 제거 (같은 ruleId)
 *   - all: 같은 ruleId를 가진 인스턴스 전체 제거
 */

// ── 타입 & 헬퍼 ───────────────────────────────────────────────────────────────

interface Entry {
  id: string
  recurringRuleId: string | null
  date: string // 'yyyy-MM-dd'
  title: string
}

/** single 삭제: 해당 id만 제거 */
function deleteSingle(entries: Entry[], id: string): Entry[] {
  return entries.filter(e => e.id !== id)
}

/** future 삭제: 같은 ruleId이면서 date >= targetDate 인 항목 제거 */
function deleteFuture(entries: Entry[], targetId: string): Entry[] {
  const target = entries.find(e => e.id === targetId)
  if (!target?.recurringRuleId) return deleteSingle(entries, targetId)
  return entries.filter(e => {
    if (e.recurringRuleId !== target.recurringRuleId) return true
    return e.date < target.date
  })
}

/** all 삭제: 같은 ruleId 전부 제거 */
function deleteAll(entries: Entry[], targetId: string): Entry[] {
  const target = entries.find(e => e.id === targetId)
  if (!target?.recurringRuleId) return deleteSingle(entries, targetId)
  return entries.filter(e => e.recurringRuleId !== target.recurringRuleId)
}

// ── 픽스처 ────────────────────────────────────────────────────────────────────

const RULE_A = 'rule-a'
const RULE_B = 'rule-b'

/** 월+수 반복 3주치 (rule-a) + 단일 항목 1개 (rule-b) */
function makeEntries(): Entry[] {
  return [
    { id: 'a1', recurringRuleId: RULE_A, date: '2026-03-23', title: '영어 화상 통화' }, // 월
    { id: 'a2', recurringRuleId: RULE_A, date: '2026-03-25', title: '영어 화상 통화' }, // 수
    { id: 'a3', recurringRuleId: RULE_A, date: '2026-03-30', title: '영어 화상 통화' }, // 월
    { id: 'a4', recurringRuleId: RULE_A, date: '2026-04-01', title: '영어 화상 통화' }, // 수
    { id: 'a5', recurringRuleId: RULE_A, date: '2026-04-06', title: '영어 화상 통화' }, // 월
    { id: 'b1', recurringRuleId: null,   date: '2026-03-24', title: '단일 미팅' },
  ]
}

// ── single 삭제 ───────────────────────────────────────────────────────────────

describe('deleteSingle', () => {
  test('해당 id만 제거, 나머지 유지', () => {
    const result = deleteSingle(makeEntries(), 'a3')
    expect(result).toHaveLength(5)
    expect(result.find(e => e.id === 'a3')).toBeUndefined()
    expect(result.find(e => e.id === 'a1')).toBeDefined()
    expect(result.find(e => e.id === 'a5')).toBeDefined()
  })

  test('단일 항목(ruleId=null) 삭제', () => {
    const result = deleteSingle(makeEntries(), 'b1')
    expect(result).toHaveLength(5)
    expect(result.find(e => e.id === 'b1')).toBeUndefined()
  })

  test('존재하지 않는 id면 원본 유지', () => {
    const entries = makeEntries()
    const result = deleteSingle(entries, 'nonexistent')
    expect(result).toHaveLength(entries.length)
  })

  test('같은 ruleId의 다른 인스턴스는 보존', () => {
    const result = deleteSingle(makeEntries(), 'a2')
    const remaining = result.filter(e => e.recurringRuleId === RULE_A)
    expect(remaining).toHaveLength(4)
  })
})

// ── future 삭제 ───────────────────────────────────────────────────────────────

describe('deleteFuture', () => {
  test('타겟 날짜 이후 같은 ruleId 항목 모두 제거', () => {
    // a3(03-30) 기준: a3, a4, a5 제거
    const result = deleteFuture(makeEntries(), 'a3')
    const remaining = result.filter(e => e.recurringRuleId === RULE_A)
    expect(remaining).toHaveLength(2) // a1, a2 만 남음
    expect(remaining.map(e => e.id)).toEqual(['a1', 'a2'])
  })

  test('타겟 날짜 이전 항목은 보존', () => {
    const result = deleteFuture(makeEntries(), 'a3')
    expect(result.find(e => e.id === 'a1')).toBeDefined()
    expect(result.find(e => e.id === 'a2')).toBeDefined()
  })

  test('다른 ruleId 항목은 영향 없음', () => {
    const result = deleteFuture(makeEntries(), 'a1')
    expect(result.find(e => e.id === 'b1')).toBeDefined()
  })

  test('첫 번째 인스턴스 future 삭제 → ruleId 전체 제거됨', () => {
    const result = deleteFuture(makeEntries(), 'a1')
    const remaining = result.filter(e => e.recurringRuleId === RULE_A)
    expect(remaining).toHaveLength(0)
  })

  test('마지막 인스턴스 future 삭제 → 해당 항목만 제거', () => {
    const result = deleteFuture(makeEntries(), 'a5')
    const remaining = result.filter(e => e.recurringRuleId === RULE_A)
    expect(remaining).toHaveLength(4)
  })

  test('ruleId=null인 단일 항목은 single과 동일하게 동작', () => {
    const result = deleteFuture(makeEntries(), 'b1')
    expect(result.find(e => e.id === 'b1')).toBeUndefined()
    expect(result).toHaveLength(5)
  })
})

// ── all 삭제 ──────────────────────────────────────────────────────────────────

describe('deleteAll', () => {
  test('같은 ruleId 항목 전체 제거', () => {
    const result = deleteAll(makeEntries(), 'a3')
    const remaining = result.filter(e => e.recurringRuleId === RULE_A)
    expect(remaining).toHaveLength(0)
  })

  test('다른 ruleId 항목은 보존', () => {
    const result = deleteAll(makeEntries(), 'a1')
    expect(result.find(e => e.id === 'b1')).toBeDefined()
  })

  test('ruleId=null인 단일 항목은 single과 동일하게 동작', () => {
    const result = deleteAll(makeEntries(), 'b1')
    expect(result.find(e => e.id === 'b1')).toBeUndefined()
    expect(result.filter(e => e.recurringRuleId === RULE_A)).toHaveLength(5)
  })

  test('어떤 인스턴스로 삭제해도 결과 동일 (rule 기준)', () => {
    const fromFirst = deleteAll(makeEntries(), 'a1')
    const fromMiddle = deleteAll(makeEntries(), 'a3')
    const fromLast = deleteAll(makeEntries(), 'a5')
    expect(fromFirst.length).toBe(fromMiddle.length)
    expect(fromMiddle.length).toBe(fromLast.length)
    expect(fromFirst.map(e => e.id)).toEqual(fromMiddle.map(e => e.id))
  })
})

// ── 삭제 모드 비교 ────────────────────────────────────────────────────────────

describe('삭제 모드 비교', () => {
  test('single < future < all 순으로 더 많이 제거', () => {
    const entries = makeEntries()
    const single = deleteSingle(entries, 'a3').length
    const future = deleteFuture(entries, 'a3').length
    const all = deleteAll(entries, 'a3').length
    expect(single).toBeGreaterThan(future)
    expect(future).toBeGreaterThan(all)
  })

  test('비반복 항목은 모든 모드에서 동일한 결과', () => {
    const s = deleteSingle(makeEntries(), 'b1').length
    const f = deleteFuture(makeEntries(), 'b1').length
    const a = deleteAll(makeEntries(), 'b1').length
    expect(s).toBe(f)
    expect(f).toBe(a)
  })
})
