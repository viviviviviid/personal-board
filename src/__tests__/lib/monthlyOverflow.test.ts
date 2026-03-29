export {}

/**
 * 월간 캘린더 셀 오버플로우 슬롯 계산 테스트
 *
 * MonthlyCalendar.tsx의 DayCell 내 슬롯/오버플로우 계산 로직 검증:
 *   - isMobile 판정: containerWidth < 640 OR cellSize < 60
 *   - maxVisible: 모바일 0, 데스크탑 1
 *   - 슬롯 배분: todo → timeline → calEvent 순, 남은 슬롯만큼 표시
 *   - overflow: 표시 못한 항목 수 합산
 */

// ── 순수 계산 함수 (MonthlyCalendar.tsx 동일 로직) ────────────────────────────

function calcIsMobile(containerWidth: number, cellSize: number): boolean {
  return containerWidth < 640 || cellSize < 60
}

function calcMaxVisible(isMobile: boolean): number {
  return isMobile ? 0 : 3
}

interface SlotResult {
  todosVisible: number
  timelineVisible: number
  calVisible: number
  overflow: number
}

function calcSlots(
  todosCount: number,
  timelineCount: number,
  calCount: number,
  maxVisible: number,
): SlotResult {
  const todosVisible = Math.min(todosCount, maxVisible)
  let slotsLeft = Math.max(0, maxVisible - todosVisible)
  const timelineVisible = Math.min(timelineCount, slotsLeft)
  slotsLeft = Math.max(0, slotsLeft - timelineVisible)
  const calVisible = Math.min(calCount, slotsLeft)
  const overflow =
    (todosCount - todosVisible) +
    (timelineCount - timelineVisible) +
    (calCount - calVisible)
  return { todosVisible, timelineVisible, calVisible, overflow }
}

// ── isMobile 판정 ─────────────────────────────────────────────────────────────

describe('calcIsMobile', () => {
  test('containerWidth < 640이면 모바일', () => {
    expect(calcIsMobile(639, 80)).toBe(true)
  })

  test('cellSize < 60이면 모바일', () => {
    expect(calcIsMobile(800, 59)).toBe(true)
  })

  test('두 조건 모두 해당하면 모바일', () => {
    expect(calcIsMobile(400, 40)).toBe(true)
  })

  test('containerWidth >= 640 AND cellSize >= 60이면 데스크탑', () => {
    expect(calcIsMobile(640, 60)).toBe(false)
    expect(calcIsMobile(1280, 90)).toBe(false)
  })

  test('경계값: containerWidth 정확히 640, cellSize 정확히 60 → 데스크탑', () => {
    expect(calcIsMobile(640, 60)).toBe(false)
  })

  test('경계값: containerWidth 639 → 모바일', () => {
    expect(calcIsMobile(639, 60)).toBe(true)
  })

  test('경계값: cellSize 59 → 모바일', () => {
    expect(calcIsMobile(640, 59)).toBe(true)
  })
})

// ── maxVisible 계산 ────────────────────────────────────────────────────────────

describe('calcMaxVisible', () => {
  test('모바일이면 maxVisible = 0', () => {
    expect(calcMaxVisible(true)).toBe(0)
  })

  test('데스크탑이면 maxVisible = 3', () => {
    expect(calcMaxVisible(false)).toBe(3)
  })
})

// ── 슬롯 배분 및 오버플로우 계산 (maxVisible = 0, 모바일) ────────────────────

describe('calcSlots - 모바일 (maxVisible=0)', () => {
  const MAX = 0

  test('항목이 없으면 overflow 0', () => {
    const r = calcSlots(0, 0, 0, MAX)
    expect(r.overflow).toBe(0)
    expect(r.todosVisible).toBe(0)
    expect(r.timelineVisible).toBe(0)
    expect(r.calVisible).toBe(0)
  })

  test('todo 1개 → 표시 0, overflow 1', () => {
    const r = calcSlots(1, 0, 0, MAX)
    expect(r.todosVisible).toBe(0)
    expect(r.overflow).toBe(1)
  })

  test('todo 2 + timeline 3 + cal 1 → 모두 overflow', () => {
    const r = calcSlots(2, 3, 1, MAX)
    expect(r.todosVisible).toBe(0)
    expect(r.timelineVisible).toBe(0)
    expect(r.calVisible).toBe(0)
    expect(r.overflow).toBe(6)
  })
})

// ── 슬롯 배분 및 오버플로우 계산 (maxVisible = 3, 데스크탑) ──────────────────

describe('calcSlots - 데스크탑 (maxVisible=3)', () => {
  const MAX = 3

  test('항목 없으면 모두 0', () => {
    const r = calcSlots(0, 0, 0, MAX)
    expect(r.todosVisible).toBe(0)
    expect(r.timelineVisible).toBe(0)
    expect(r.calVisible).toBe(0)
    expect(r.overflow).toBe(0)
  })

  test('todo 1개만 → 1 표시, overflow 0', () => {
    const r = calcSlots(1, 0, 0, MAX)
    expect(r.todosVisible).toBe(1)
    expect(r.overflow).toBe(0)
  })

  test('todo 3개 → 3 표시, overflow 0', () => {
    const r = calcSlots(3, 0, 0, MAX)
    expect(r.todosVisible).toBe(3)
    expect(r.overflow).toBe(0)
  })

  test('todo 4개 → 3 표시, overflow 1', () => {
    const r = calcSlots(4, 0, 0, MAX)
    expect(r.todosVisible).toBe(3)
    expect(r.overflow).toBe(1)
  })

  test('todo 1 + timeline 1 + cal 1 → 각 1개씩 3 표시, overflow 0', () => {
    const r = calcSlots(1, 1, 1, MAX)
    expect(r.todosVisible).toBe(1)
    expect(r.timelineVisible).toBe(1)
    expect(r.calVisible).toBe(1)
    expect(r.overflow).toBe(0)
  })

  test('todo 2 + timeline 2 → 2+1 표시, overflow 1', () => {
    const r = calcSlots(2, 2, 0, MAX)
    expect(r.todosVisible).toBe(2)
    expect(r.timelineVisible).toBe(1)
    expect(r.overflow).toBe(1)
  })

  test('todo 0 + timeline 3 + cal 2 → timeline 3 표시, cal overflow', () => {
    const r = calcSlots(0, 3, 2, MAX)
    expect(r.todosVisible).toBe(0)
    expect(r.timelineVisible).toBe(3)
    expect(r.calVisible).toBe(0)
    expect(r.overflow).toBe(2)
  })

  test('todo 3 + timeline 2 + cal 1 → todo 3 표시, 나머지 overflow = 3', () => {
    const r = calcSlots(3, 2, 1, MAX)
    expect(r.todosVisible).toBe(3)
    expect(r.timelineVisible).toBe(0)
    expect(r.calVisible).toBe(0)
    expect(r.overflow).toBe(3)
  })

  test('todo 0 + timeline 0 + cal 5 → cal 3 표시, overflow 2', () => {
    const r = calcSlots(0, 0, 5, MAX)
    expect(r.calVisible).toBe(3)
    expect(r.overflow).toBe(2)
  })
})

// ── 모바일 vs 데스크탑 비교 시나리오 ──────────────────────────────────────────

describe('모바일 vs 데스크탑 overflow 비교', () => {
  test('같은 데이터에서 모바일은 항상 오버플로우가 더 많거나 같음', () => {
    const scenarios = [
      { todos: 1, timeline: 2, cal: 1 },
      { todos: 0, timeline: 3, cal: 0 },
      { todos: 2, timeline: 0, cal: 2 },
    ]
    for (const { todos, timeline, cal } of scenarios) {
      const mobile = calcSlots(todos, timeline, cal, 0)
      const desktop = calcSlots(todos, timeline, cal, 1)
      expect(mobile.overflow).toBeGreaterThanOrEqual(desktop.overflow)
    }
  })

  test('항목 없으면 모바일/데스크탑 모두 overflow 0', () => {
    expect(calcSlots(0, 0, 0, 0).overflow).toBe(0)
    expect(calcSlots(0, 0, 0, 3).overflow).toBe(0)
  })

  test('데스크탑에서 todo 1개만 있으면 overflow 없이 1 표시', () => {
    const r = calcSlots(1, 0, 0, calcMaxVisible(false))
    expect(r.overflow).toBe(0)
  })

  test('모바일에서 todo 1개 있으면 +1 오버플로우 표시', () => {
    const r = calcSlots(1, 0, 0, calcMaxVisible(true))
    expect(r.overflow).toBe(1)
  })
})
