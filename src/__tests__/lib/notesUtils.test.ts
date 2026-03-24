export {}

import { parseTags, sanitizeTag, serializeTags, noteDisplayTitle, matchesSearch } from '@/lib/noteUtils'

// ── parseTags ─────────────────────────────────────────────────────────────────

describe('parseTags', () => {
  test('null → 빈 배열', () => {
    expect(parseTags(null)).toEqual([])
  })

  test('빈 문자열 → 빈 배열', () => {
    expect(parseTags('')).toEqual([])
  })

  test('단일 태그', () => {
    expect(parseTags('개인')).toEqual(['개인'])
  })

  test('여러 태그 콤마 구분', () => {
    expect(parseTags('아이디어,개인,비밀번호')).toEqual(['아이디어', '개인', '비밀번호'])
  })

  test('태그 주변 공백 trim', () => {
    expect(parseTags('tag1, tag2 , tag3')).toEqual(['tag1', 'tag2', 'tag3'])
  })

  test('앞뒤 콤마 및 빈 항목 제거', () => {
    expect(parseTags(',tag1,,tag2,')).toEqual(['tag1', 'tag2'])
  })

  test('공백만 있는 항목 제거', () => {
    expect(parseTags('tag1,   ,tag2')).toEqual(['tag1', 'tag2'])
  })

  test('단일 공백 문자열', () => {
    expect(parseTags('   ')).toEqual([])
  })
})

// ── sanitizeTag ───────────────────────────────────────────────────────────────

describe('sanitizeTag', () => {
  test('일반 태그 그대로 반환', () => {
    expect(sanitizeTag('개인')).toBe('개인')
  })

  test('앞뒤 공백 trim', () => {
    expect(sanitizeTag('  태그  ')).toBe('태그')
  })

  test('콤마 제거', () => {
    expect(sanitizeTag('tag,with,comma')).toBe('tagwithcomma')
  })

  test('콤마 + 공백 혼합', () => {
    expect(sanitizeTag('  tag1, tag2  ')).toBe('tag1 tag2')
  })

  test('빈 문자열', () => {
    expect(sanitizeTag('')).toBe('')
  })

  test('공백만', () => {
    expect(sanitizeTag('   ')).toBe('')
  })
})

// ── serializeTags ─────────────────────────────────────────────────────────────

describe('serializeTags', () => {
  test('빈 배열 → 빈 문자열', () => {
    expect(serializeTags([])).toBe('')
  })

  test('단일 태그', () => {
    expect(serializeTags(['개인'])).toBe('개인')
  })

  test('여러 태그 콤마로 결합', () => {
    expect(serializeTags(['아이디어', '개인', '비밀번호'])).toBe('아이디어,개인,비밀번호')
  })

  test('parseTags(serializeTags(tags)) 왕복 변환', () => {
    const original = ['tag1', 'tag2', 'tag3']
    expect(parseTags(serializeTags(original))).toEqual(original)
  })
})

// ── noteDisplayTitle ──────────────────────────────────────────────────────────

describe('noteDisplayTitle', () => {
  test('제목 있으면 제목 반환', () => {
    expect(noteDisplayTitle({ title: '내 메모', content: '본문' })).toBe('내 메모')
  })

  test('제목 null이면 본문 첫 줄 사용', () => {
    expect(noteDisplayTitle({ title: null, content: '첫 번째 줄\n두 번째 줄' })).toBe('첫 번째 줄')
  })

  test('제목 빈 문자열이면 본문 첫 줄 사용', () => {
    expect(noteDisplayTitle({ title: '', content: '본문 내용' })).toBe('본문 내용')
  })

  test('제목 공백만 있으면 본문 첫 줄 사용', () => {
    expect(noteDisplayTitle({ title: '   ', content: '본문' })).toBe('본문')
  })

  test('제목·본문 모두 없으면 제목 없음', () => {
    expect(noteDisplayTitle({ title: null, content: '' })).toBe('제목 없음')
  })

  test('본문 첫 줄이 공백만이면 제목 없음', () => {
    expect(noteDisplayTitle({ title: null, content: '   \n두 번째 줄' })).toBe('제목 없음')
  })

  test('본문 첫 줄 40자 초과 시 잘라냄', () => {
    const longContent = 'a'.repeat(50)
    const result = noteDisplayTitle({ title: null, content: longContent })
    expect(result).toHaveLength(40)
    expect(result).toBe('a'.repeat(40))
  })

  test('제목 trim 적용 (앞뒤 공백 제거 후 반환)', () => {
    expect(noteDisplayTitle({ title: '  내 메모  ', content: '본문' })).toBe('내 메모')
  })
})

// ── matchesSearch ─────────────────────────────────────────────────────────────

describe('matchesSearch', () => {
  const note = { title: '쇼핑 목록', content: '사과, 바나나, 우유' }

  test('제목에서 검색 성공', () => {
    expect(matchesSearch(note, '쇼핑')).toBe(true)
  })

  test('내용에서 검색 성공', () => {
    expect(matchesSearch(note, '바나나')).toBe(true)
  })

  test('대소문자 무시 (영문)', () => {
    const en = { title: 'Shopping List', content: 'Apples and Bananas' }
    expect(matchesSearch(en, 'shopping')).toBe(true)
    expect(matchesSearch(en, 'BANANAS')).toBe(true)
  })

  test('매칭 없으면 false', () => {
    expect(matchesSearch(note, '오렌지')).toBe(false)
  })

  test('빈 검색어 → 모든 노트 매칭', () => {
    expect(matchesSearch(note, '')).toBe(true)
  })

  test('제목 null이어도 내용에서 검색', () => {
    expect(matchesSearch({ title: null, content: '중요한 메모' }, '중요')).toBe(true)
  })

  test('제목 null이고 내용에도 없으면 false', () => {
    expect(matchesSearch({ title: null, content: '내용' }, '없는것')).toBe(false)
  })

  test('부분 일치 검색', () => {
    expect(matchesSearch(note, '쇼')).toBe(true)
    expect(matchesSearch(note, '나나')).toBe(true)
  })
})

// ── parseTags + serializeTags + sanitizeTag 통합 ──────────────────────────────

describe('태그 통합 시나리오', () => {
  test('콤마 포함 입력 sanitize 후 추가해도 파싱 정상', () => {
    const existing = parseTags('tag1,tag2')
    const raw = 'tag3,tag4'           // 사용자가 콤마 포함 입력
    const sanitized = sanitizeTag(raw) // "tag3tag4" (콤마 제거)
    const serialized = serializeTags([...existing, sanitized])
    expect(parseTags(serialized)).toEqual(['tag1', 'tag2', 'tag3tag4'])
  })

  test('중복 태그는 추가되지 않음 (UI 레벨)', () => {
    const existing = parseTags('tag1,tag2')
    const newTag = sanitizeTag('tag1')
    const isDuplicate = existing.includes(newTag)
    expect(isDuplicate).toBe(true)
    // 중복이면 추가 안 함 → 기존 유지
    const result = isDuplicate ? existing : [...existing, newTag]
    expect(result).toEqual(['tag1', 'tag2'])
  })

  test('태그 제거 후 직렬화 왕복', () => {
    const tags = parseTags('tag1,tag2,tag3')
    const removed = tags.filter(t => t !== 'tag2')
    expect(parseTags(serializeTags(removed))).toEqual(['tag1', 'tag3'])
  })

  test('모든 태그 제거 시 빈 문자열 직렬화', () => {
    const tags = parseTags('tag1')
    const removed = tags.filter(t => t !== 'tag1')
    expect(serializeTags(removed)).toBe('')
    expect(parseTags(serializeTags(removed))).toEqual([])
  })
})
