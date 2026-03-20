export const FIRST_HOUR = 5
export const LAST_HOUR = 23
export const ROW_H = 52          // px per hour
export const SNAP = 15           // snap to 15-min
export const TOTAL_H = (LAST_HOUR - FIRST_HOUR + 1) * ROW_H

export function timeToY(time: string): number {
  const [h, m] = time.split(':').map(Number)
  return (h - FIRST_HOUR) * ROW_H + (m / 60) * ROW_H
}

export function yToTime(y: number): string {
  const clamped = Math.max(0, Math.min(y, TOTAL_H - ROW_H / 4))
  const totalMin = clamped / ROW_H * 60
  const snapped = Math.round(totalMin / SNAP) * SNAP
  const h = FIRST_HOUR + Math.floor(snapped / 60)
  const m = snapped % 60
  const clampH = Math.min(LAST_HOUR, Math.max(FIRST_HOUR, h))
  return `${String(clampH).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}

export function addOneHour(time: string): string {
  const [h, m] = time.split(':').map(Number)
  return `${String(Math.min(LAST_HOUR, h + 1)).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}

export function nowToY(now: Date): number | null {
  const h = now.getHours()
  const m = now.getMinutes()
  if (h < FIRST_HOUR || h > LAST_HOUR) return null
  const timeStr = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
  return timeToY(timeStr)
}
