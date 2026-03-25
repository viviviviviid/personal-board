export {}

import { parseContent, serializeContent } from '@/lib/vaultContent'

// ── serializeContent ──────────────────────────────────────────────────────────

describe('serializeContent', () => {
  test('rows + note를 JSON으로 직렬화', () => {
    const content = {
      rows: [{ id: 'r1', key: 'username', value: 'alice' }],
      note: '메모',
    }
    const json = serializeContent(content)
    expect(JSON.parse(json)).toEqual(content)
  })

  test('빈 rows + 빈 note', () => {
    const content = { rows: [], note: '' }
    expect(JSON.parse(serializeContent(content))).toEqual(content)
  })
})

// ── parseContent ──────────────────────────────────────────────────────────────

describe('parseContent', () => {
  test('정상 JSON → VaultContent 반환', () => {
    const content = {
      rows: [
        { id: 'r1', key: 'username', value: 'alice' },
        { id: 'r2', key: 'password', value: 's3cret' },
      ],
      note: '추가 메모',
    }
    const result = parseContent(JSON.stringify(content))
    expect(result.rows).toEqual(content.rows)
    expect(result.note).toBe('추가 메모')
  })

  test('빈 rows JSON → rows: [], note: ""', () => {
    const result = parseContent(JSON.stringify({ rows: [], note: '' }))
    expect(result.rows).toEqual([])
    expect(result.note).toBe('')
  })

  test('구형 평문 포맷 → 단일 행으로 변환', () => {
    const result = parseContent('my_api_key_123')
    expect(result.rows).toHaveLength(1)
    expect(result.rows[0].value).toBe('my_api_key_123')
    expect(result.rows[0].key).toBe('')
    expect(result.note).toBe('')
  })

  test('구형 빈 문자열 → rows: []', () => {
    const result = parseContent('')
    expect(result.rows).toEqual([])
    expect(result.note).toBe('')
  })

  test('rows 필드 없는 JSON → 구형 포맷으로 처리', () => {
    const result = parseContent(JSON.stringify({ type: 'password', value: 'abc' }))
    // rows 없으면 평문으로 간주, 전체 JSON 문자열이 value에 들어감
    expect(result.rows).toHaveLength(1)
    expect(result.rows[0].key).toBe('')
  })

  test('유효하지 않은 JSON → 평문으로 처리', () => {
    const result = parseContent('{broken json')
    expect(result.rows).toHaveLength(1)
    expect(result.rows[0].value).toBe('{broken json')
  })
})

// ── 직렬화 왕복 ────────────────────────────────────────────────────────────────

describe('parseContent + serializeContent 왕복', () => {
  test('여러 행 왕복', () => {
    const original = {
      rows: [
        { id: 'r1', key: 'username', value: 'alice' },
        { id: 'r2', key: 'password', value: 'P@ssw0rd!' },
        { id: 'r3', key: 'mnemonic', value: 'word1 word2 word3 word4 word5 word6 word7 word8 word9 word10 word11 word12' },
      ],
      note: '비트코인 지갑 정보',
    }
    const result = parseContent(serializeContent(original))
    expect(result.rows).toEqual(original.rows)
    expect(result.note).toBe(original.note)
  })

  test('특수문자 포함 값 왕복', () => {
    const original = {
      rows: [{ id: 'r1', key: 'api_key', value: 'sk-abc123!@#$%^&*()' }],
      note: '',
    }
    const result = parseContent(serializeContent(original))
    expect(result.rows[0].value).toBe('sk-abc123!@#$%^&*()')
  })

  test('한글 포함 왕복', () => {
    const original = {
      rows: [{ id: 'r1', key: '계정 이름', value: '홍길동@example.com' }],
      note: '중요한 계정',
    }
    const result = parseContent(serializeContent(original))
    expect(result.rows[0].key).toBe('계정 이름')
    expect(result.rows[0].value).toBe('홍길동@example.com')
    expect(result.note).toBe('중요한 계정')
  })
})
