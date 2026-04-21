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
    // Skip if FIRST_HOUR is 0 (no hour before midnight)
    if (FIRST_HOUR > 0) {
      const before = new Date()
      before.setHours(FIRST_HOUR - 1, 0, 0, 0)
      expect(nowToY(before)).toBeNull()
    } else {
      // At FIRST_HOUR=0, all times are within range
      expect(FIRST_HOUR).toBe(0)
    }
  })

  test('handles hours at and around LAST_HOUR', () => {
    // With LAST_HOUR=24, getHours() maxes at 23 so direct test isn't possible
    // Instead verify that valid hours within range return numbers
    const validHours = [FIRST_HOUR, 12, 23]
    for (const h of validHours) {
      const t = new Date()
      t.setHours(h, 0, 0, 0)
      expect(typeof nowToY(t)).toBe('number')
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

describe('Midnight support (0:00 - 24:00)', () => {
  test('FIRST_HOUR=0 supports midnight', () => {
    expect(FIRST_HOUR).toBe(0)
  })

  test('LAST_HOUR=24 supports full 24-hour range', () => {
    expect(LAST_HOUR).toBe(24)
  })

  test('timeToY maps 00:00 to y=0', () => {
    expect(timeToY('00:00')).toBe(0)
  })

  test('timeToY maps 12:00 (noon) to middle of day', () => {
    const noonY = timeToY('12:00')
    const expectedY = (12 - FIRST_HOUR) * ROW_H
    expect(noonY).toBe(expectedY)
  })

  test('timeToY maps 23:00 to near end', () => {
    const y = timeToY('23:00')
    expect(y).toBeGreaterThan(0)
    expect(y).toBeLessThan(TOTAL_H)
  })

  test('yToTime for early morning hours', () => {
    expect(yToTime(0)).toBe('00:00')
    expect(yToTime(ROW_H)).toBe('01:00')
    expect(yToTime(ROW_H * 4)).toBe('04:00')
  })

  test('yToTime for afternoon hours', () => {
    const y12 = (12 - FIRST_HOUR) * ROW_H
    const y18 = (18 - FIRST_HOUR) * ROW_H
    expect(yToTime(y12)).toBe('12:00')
    expect(yToTime(y18)).toBe('18:00')
  })

  test('addOneHour works from morning to afternoon', () => {
    expect(addOneHour('00:00')).toBe('01:00')
    expect(addOneHour('06:30')).toBe('07:30')
    expect(addOneHour('11:45')).toBe('12:45')
  })

  test('addOneHour clamps at LAST_HOUR=24', () => {
    const result = addOneHour('23:30')
    const hour = parseInt(result.split(':')[0])
    expect(hour).toBeLessThanOrEqual(LAST_HOUR)
  })

  test('TOTAL_H represents 24 hours of ROW_H pixels', () => {
    expect(TOTAL_H).toBe(25 * ROW_H) // (24 - 0 + 1) * 52
  })
})
