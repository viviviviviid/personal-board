export interface VaultRow {
  id: string
  key: string
  value: string
}

export interface VaultContent {
  rows: VaultRow[]
  note: string
}

export function newRowId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2)
}

export function parseContent(raw: string): VaultContent {
  try {
    const parsed = JSON.parse(raw)
    if (parsed && Array.isArray(parsed.rows)) return parsed
  } catch { /* 구형 평문 포맷 */ }
  // 구형 포맷: 평문 문자열을 단일 행으로 변환
  return { rows: raw ? [{ id: newRowId(), key: '', value: raw }] : [], note: '' }
}

export function serializeContent(content: VaultContent): string {
  return JSON.stringify(content)
}
