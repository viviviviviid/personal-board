export {}

/**
 * AI 피드백 라우트 순수 로직 테스트
 *
 * src/app/api/ai/feedback/route.ts 내 순수 계산 로직:
 *   - includedDataLabel: dataTypes 배열 → 한국어 레이블 문자열
 *   - completionRate: 완료 투두 수 / 전체 투두 수 → 퍼센트
 */

// ── includedDataLabel 생성 함수 (route.ts 동일 로직) ─────────────────────────

function buildIncludedDataLabel(dataTypes: string[]): string {
  return [
    dataTypes.includes('todos') ? '투두' : null,
    dataTypes.includes('timeline') ? '타임라인' : null,
    dataTypes.includes('habits') ? '습관' : null,
    dataTypes.includes('highlights') ? '데일리 하이라이트' : null,
  ]
    .filter(Boolean)
    .join(', ')
}

// ── completionRate 계산 함수 (route.ts 동일 로직) ────────────────────────────

function calcCompletionRate(totalTodos: number, completedTodos: number): number {
  return totalTodos > 0 ? Math.round((completedTodos / totalTodos) * 100) : 0
}

// ── includedDataLabel ─────────────────────────────────────────────────────────

describe('buildIncludedDataLabel', () => {
  test('4가지 모두 포함', () => {
    const label = buildIncludedDataLabel(['todos', 'timeline', 'habits', 'highlights'])
    expect(label).toBe('투두, 타임라인, 습관, 데일리 하이라이트')
  })

  test('빈 배열 → 빈 문자열', () => {
    expect(buildIncludedDataLabel([])).toBe('')
  })

  test('todos만 포함', () => {
    expect(buildIncludedDataLabel(['todos'])).toBe('투두')
  })

  test('timeline만 포함', () => {
    expect(buildIncludedDataLabel(['timeline'])).toBe('타임라인')
  })

  test('habits만 포함', () => {
    expect(buildIncludedDataLabel(['habits'])).toBe('습관')
  })

  test('highlights만 포함', () => {
    expect(buildIncludedDataLabel(['highlights'])).toBe('데일리 하이라이트')
  })

  test('todos + habits (timeline, highlights 제외)', () => {
    const label = buildIncludedDataLabel(['todos', 'habits'])
    expect(label).toBe('투두, 습관')
  })

  test('timeline + highlights (todos, habits 제외)', () => {
    const label = buildIncludedDataLabel(['timeline', 'highlights'])
    expect(label).toBe('타임라인, 데일리 하이라이트')
  })

  test('알 수 없는 값은 무시', () => {
    const label = buildIncludedDataLabel(['todos', 'unknown', 'foobar'])
    expect(label).toBe('투두')
  })

  test('중복 값이 들어와도 레이블 한 번만 출력', () => {
    // includes()는 배열에 존재하는지만 체크하므로 중복 무관
    const label = buildIncludedDataLabel(['todos', 'todos', 'habits'])
    expect(label).toBe('투두, 습관')
  })

  test('순서는 todos→timeline→habits→highlights 고정', () => {
    // 입력 순서가 달라도 출력 순서는 항상 동일
    const label = buildIncludedDataLabel(['highlights', 'habits', 'timeline', 'todos'])
    expect(label).toBe('투두, 타임라인, 습관, 데일리 하이라이트')
  })

  test('rawDataTypes null → 기본값 적용 시 4가지 모두', () => {
    // route.ts: const dataTypes = rawDataTypes ?? ['todos','timeline','habits','highlights']
    const rawDataTypes: string[] | null = null
    const dataTypes = rawDataTypes ?? ['todos', 'timeline', 'habits', 'highlights']
    expect(buildIncludedDataLabel(dataTypes)).toBe('투두, 타임라인, 습관, 데일리 하이라이트')
  })
})

// ── completionRate ────────────────────────────────────────────────────────────

describe('calcCompletionRate', () => {
  test('투두 없으면 0%', () => {
    expect(calcCompletionRate(0, 0)).toBe(0)
  })

  test('전체 완료 → 100%', () => {
    expect(calcCompletionRate(10, 10)).toBe(100)
  })

  test('절반 완료 → 50%', () => {
    expect(calcCompletionRate(10, 5)).toBe(50)
  })

  test('1개 중 1개 완료 → 100%', () => {
    expect(calcCompletionRate(1, 1)).toBe(100)
  })

  test('1개 중 0개 완료 → 0%', () => {
    expect(calcCompletionRate(1, 0)).toBe(0)
  })

  test('3개 중 1개 완료 → 33% (반올림)', () => {
    expect(calcCompletionRate(3, 1)).toBe(33)
  })

  test('3개 중 2개 완료 → 67% (반올림)', () => {
    expect(calcCompletionRate(3, 2)).toBe(67)
  })

  test('7개 중 3개 완료 → 43% (반올림)', () => {
    expect(calcCompletionRate(7, 3)).toBe(43)
  })

  test('completedTodos > totalTodos는 현실에서 발생 안 하지만 계산식은 동작', () => {
    // 100% 초과 케이스 — 방어적 확인
    expect(calcCompletionRate(5, 6)).toBe(120)
  })

  test('0 나눗셈 방지 — totalTodos=0, completedTodos=0 → 0', () => {
    expect(calcCompletionRate(0, 0)).toBe(0)
  })

  test('대량 데이터 정확성 (100개 중 73개)', () => {
    expect(calcCompletionRate(100, 73)).toBe(73)
  })
})

// ── 통합: dataTypes 기본값 fallback + completionRate ────────────────────────

describe('AI 피드백 라우트 통합 시나리오', () => {
  test('dataTypes 미전달 시 기본 4가지 레이블 생성', () => {
    const raw = undefined
    const dataTypes = raw ?? ['todos', 'timeline', 'habits', 'highlights']
    const label = buildIncludedDataLabel(dataTypes)
    expect(label).toBe('투두, 타임라인, 습관, 데일리 하이라이트')
  })

  test('데이터 없는 주: 0% 완료율 + 레이블 정상 생성', () => {
    const dataTypes = ['todos', 'timeline']
    const rate = calcCompletionRate(0, 0)
    const label = buildIncludedDataLabel(dataTypes)
    expect(rate).toBe(0)
    expect(label).toBe('투두, 타임라인')
  })

  test('투두만 선택 + 절반 완료 → 레이블+퍼센트 정합', () => {
    const dataTypes = ['todos']
    const rate = calcCompletionRate(20, 10)
    const label = buildIncludedDataLabel(dataTypes)
    expect(rate).toBe(50)
    expect(label).toBe('투두')
  })
})
