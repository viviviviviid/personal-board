import {
  FIRST_HOUR, LAST_HOUR, ROW_H, SNAP, TOTAL_H,
  timeToY, yToTime, addOneHour, nowToY,
} from '@/lib/timeUtils'

describe('timeUtils constants', () => {
  test('TOTAL_H covers full range', () => {
    expect(TOTAL_H).toBe((LAST_HOUR - FIRST_HOUR + 1) * ROW_H)
  })

  test('FIRST_HOUR is before LAST_HOUR', () => {
    expect(FIRST_HOUR).toBeLessThan(LAST_HOUR)
  })
})

describe('timeToY', () => {
  test('FIRST_HOUR:00 maps to y=0', () => {
    expect(timeToY(`${String(FIRST_HOUR).padStart(2, '0')}:00`)).toBe(0)
  })

  test('one hour later maps to ROW_H', () => {
    const next = FIRST_HOUR + 1
    expect(timeToY(`${String(next).padStart(2, '0')}:00`)).toBe(ROW_H)
  })

  test('30 minutes = ROW_H / 2', () => {
    expect(timeToY(`${String(FIRST_HOUR).padStart(2, '0')}:30`)).toBe(ROW_H / 2)
  })

  test('last hour maps to TOTAL_H - ROW_H', () => {
    expect(timeToY(`${String(LAST_HOUR).padStart(2, '0')}:00`)).toBe(TOTAL_H - ROW_H)
  })
})

describe('yToTime', () => {
  test('y=0 returns FIRST_HOUR:00', () => {
    expect(yToTime(0)).toBe(`${String(FIRST_HOUR).padStart(2, '0')}:00`)
  })

  test('y=ROW_H returns FIRST_HOUR+1:00', () => {
    expect(yToTime(ROW_H)).toBe(`${String(FIRST_HOUR + 1).padStart(2, '0')}:00`)
  })

  test('snaps to nearest SNAP minutes', () => {
    // 7 minutes in → should snap to 0 (nearest 15-min)
    const y = (7 / 60) * ROW_H
    const result = yToTime(y)
    expect(result).toBe(`${String(FIRST_HOUR).padStart(2, '0')}:00`)
  })

  test('snaps up at 8 minutes', () => {
    // 8 minutes in → should snap to 15 (nearest 15-min)
    const y = (8 / 60) * ROW_H
    const result = yToTime(y)
    expect(result).toBe(`${String(FIRST_HOUR).padStart(2, '0')}:15`)
  })

  test('clamps negative y to FIRST_HOUR:00', () => {
    expect(yToTime(-100)).toBe(`${String(FIRST_HOUR).padStart(2, '0')}:00`)
  })

  test('clamps excess y to LAST_HOUR', () => {
    const result = yToTime(TOTAL_H + 9999)
    const hour = parseInt(result.split(':')[0])
    expect(hour).toBeLessThanOrEqual(LAST_HOUR)
  })

  test('roundtrip: timeToY → yToTime is stable for snapped times', () => {
    const times = ['06:00', '09:15', '12:30', '18:45', '22:00']
    for (const t of times) {
      expect(yToTime(timeToY(t))).toBe(t)
    }
  })
})

describe('addOneHour', () => {
  test('adds one hour', () => {
    expect(addOneHour('09:30')).toBe('10:30')
  })

  test('clamps at LAST_HOUR', () => {
    const result = addOneHour(`${String(LAST_HOUR).padStart(2, '0')}:00`)
    expect(result).toBe(`${String(LAST_HOUR).padStart(2, '0')}:00`)
  })

  test('preserves minutes', () => {
    expect(addOneHour('10:45')).toBe('11:45')
  })
})

describe('nowToY', () => {
  test('returns null for hours before FIRST_HOUR', () => {
    const before = new Date()
    before.setHours(FIRST_HOUR - 1, 0, 0, 0)
    expect(nowToY(before)).toBeNull()
  })

  test('returns null for hours after LAST_HOUR', () => {
    // LAST_HOUR + 1 would be next day if LAST_HOUR is 23, skip if not possible
    if (LAST_HOUR < 23) {
      const after = new Date()
      after.setHours(LAST_HOUR + 1, 0, 0, 0)
      expect(nowToY(after)).toBeNull()
    }
  })

  test('returns a number for a valid hour', () => {
    const valid = new Date()
    valid.setHours(FIRST_HOUR + 2, 0, 0, 0)
    expect(typeof nowToY(valid)).toBe('number')
  })

  test('returns 0 for FIRST_HOUR:00', () => {
    const t = new Date()
    t.setHours(FIRST_HOUR, 0, 0, 0)
    expect(nowToY(t)).toBe(0)
  })
})
