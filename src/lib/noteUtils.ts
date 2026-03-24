export interface NoteForDisplay {
  title: string | null
  content: string
}

/** 콤마 구분 태그 문자열 → 배열. 공백 trim, 빈 항목 제거. */
export function parseTags(tags: string | null): string[] {
  return (tags ?? '').split(',').map(t => t.trim()).filter(Boolean)
}

/** 태그 입력값에서 콤마 제거 + trim. */
export function sanitizeTag(input: string): string {
  return input.replace(/,/g, '').trim()
}

/** 태그 배열 → 저장용 문자열. */
export function serializeTags(tags: string[]): string {
  return tags.join(',')
}

/** 메모 표시 제목: 제목 없으면 본문 첫 줄(최대 40자), 둘 다 없으면 '제목 없음'. */
export function noteDisplayTitle(note: NoteForDisplay): string {
  if (note.title?.trim()) return note.title.trim()
  const firstLine = note.content.split('\n')[0].trim()
  return firstLine.slice(0, 40) || '제목 없음'
}

/** 메모가 검색어에 매칭되는지 (제목 + 내용 대소문자 무시). */
export function matchesSearch(note: NoteForDisplay, q: string): boolean {
  const lower = q.toLowerCase()
  return (
    (note.title?.toLowerCase().includes(lower) ?? false) ||
    note.content.toLowerCase().includes(lower)
  )
}
