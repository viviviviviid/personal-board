export {}

// Node.js 환경에서 Web Crypto API 폴리필
import { webcrypto } from 'crypto'
if (!globalThis.crypto) {
  Object.defineProperty(globalThis, 'crypto', { value: webcrypto })
}

import { deriveKey, encryptText, decryptText, randomSaltHex } from '@/lib/vaultCrypto'

// ── randomSaltHex ─────────────────────────────────────────────────────────────

describe('randomSaltHex', () => {
  test('32자 hex 문자열 반환', () => {
    const salt = randomSaltHex()
    expect(salt).toHaveLength(32)
    expect(salt).toMatch(/^[0-9a-f]+$/)
  })

  test('호출마다 다른 값 생성', () => {
    const a = randomSaltHex()
    const b = randomSaltHex()
    expect(a).not.toBe(b)
  })
})

// ── deriveKey ─────────────────────────────────────────────────────────────────

describe('deriveKey', () => {
  test('같은 비밀번호 + salt → 복호화 가능한 키 생성', async () => {
    const salt = randomSaltHex()
    const key = await deriveKey('TestPassword123!', salt)
    expect(key).toBeDefined()
    expect(key.type).toBe('secret')
    expect(key.algorithm.name).toBe('AES-GCM')
  })

  test('같은 비밀번호 + salt → 동일 키로 암복호화 성공', async () => {
    const salt = randomSaltHex()
    const key1 = await deriveKey('SamePassword!', salt)
    const key2 = await deriveKey('SamePassword!', salt)
    const { iv, ciphertext } = await encryptText(key1, '테스트 평문')
    const decrypted = await decryptText(key2, iv, ciphertext)
    expect(decrypted).toBe('테스트 평문')
  })

  test('다른 비밀번호 → 다른 키로 복호화 실패', async () => {
    const salt = randomSaltHex()
    const key1 = await deriveKey('PasswordA!', salt)
    const key2 = await deriveKey('PasswordB!', salt)
    const { iv, ciphertext } = await encryptText(key1, '비밀 데이터')
    await expect(decryptText(key2, iv, ciphertext)).rejects.toThrow()
  })

  test('같은 비밀번호라도 salt 다르면 다른 키', async () => {
    const salt1 = randomSaltHex()
    const salt2 = randomSaltHex()
    const key1 = await deriveKey('SamePassword!', salt1)
    const key2 = await deriveKey('SamePassword!', salt2)
    const { iv, ciphertext } = await encryptText(key1, '데이터')
    await expect(decryptText(key2, iv, ciphertext)).rejects.toThrow()
  })
})

// ── encryptText ───────────────────────────────────────────────────────────────

describe('encryptText', () => {
  test('{ iv, ciphertext } 반환', async () => {
    const key = await deriveKey('Password123!', randomSaltHex())
    const result = await encryptText(key, 'hello')
    expect(result).toHaveProperty('iv')
    expect(result).toHaveProperty('ciphertext')
    expect(typeof result.iv).toBe('string')
    expect(typeof result.ciphertext).toBe('string')
  })

  test('iv는 base64, 길이 16자 (12바이트)', async () => {
    const key = await deriveKey('Password123!', randomSaltHex())
    const { iv } = await encryptText(key, 'hello')
    const ivBytes = Uint8Array.from(atob(iv), c => c.charCodeAt(0))
    expect(ivBytes.length).toBe(12)
  })

  test('같은 평문도 암호화마다 다른 iv + ciphertext', async () => {
    const key = await deriveKey('Password123!', randomSaltHex())
    const a = await encryptText(key, '동일한 텍스트')
    const b = await encryptText(key, '동일한 텍스트')
    expect(a.iv).not.toBe(b.iv)
    expect(a.ciphertext).not.toBe(b.ciphertext)
  })

  test('빈 문자열도 암호화 가능', async () => {
    const key = await deriveKey('Password123!', randomSaltHex())
    const { iv, ciphertext } = await encryptText(key, '')
    const decrypted = await decryptText(key, iv, ciphertext)
    expect(decrypted).toBe('')
  })
})

// ── decryptText ───────────────────────────────────────────────────────────────

describe('decryptText', () => {
  test('암복호화 왕복 (한글)', async () => {
    const key = await deriveKey('강력한비밀번호1!', randomSaltHex())
    const plain = '안녕하세요, 금고 테스트입니다.'
    const { iv, ciphertext } = await encryptText(key, plain)
    expect(await decryptText(key, iv, ciphertext)).toBe(plain)
  })

  test('암복호화 왕복 (니모닉 문구)', async () => {
    const key = await deriveKey('Password123!', randomSaltHex())
    const mnemonic = 'word1 word2 word3 word4 word5 word6 word7 word8 word9 word10 word11 word12'
    const { iv, ciphertext } = await encryptText(key, mnemonic)
    expect(await decryptText(key, iv, ciphertext)).toBe(mnemonic)
  })

  test('암복호화 왕복 (특수문자 포함 비밀번호)', async () => {
    const key = await deriveKey('Password123!', randomSaltHex())
    const secret = 'P@ssw0rd!#$%^&*()'
    const { iv, ciphertext } = await encryptText(key, secret)
    expect(await decryptText(key, iv, ciphertext)).toBe(secret)
  })

  test('잘못된 iv → 복호화 실패', async () => {
    const key = await deriveKey('Password123!', randomSaltHex())
    const { ciphertext } = await encryptText(key, '데이터')
    const wrongIv = btoa(String.fromCharCode(...new Uint8Array(12)))
    await expect(decryptText(key, wrongIv, ciphertext)).rejects.toThrow()
  })

  test('손상된 ciphertext → 복호화 실패', async () => {
    const key = await deriveKey('Password123!', randomSaltHex())
    const { iv } = await encryptText(key, '데이터')
    const badCiphertext = btoa('corrupted')
    await expect(decryptText(key, iv, badCiphertext)).rejects.toThrow()
  })
})

// ── 금고 잠금 해제 시나리오 ────────────────────────────────────────────────────

describe('금고 verifier 시나리오', () => {
  const VERIFIER_SENTINEL = 'vault-verified'

  test('올바른 비밀번호로 verifier 검증 성공', async () => {
    const salt = randomSaltHex()
    const masterPassword = 'MyVaultPassword1!'

    // 최초 설정: verifier 생성
    const setupKey = await deriveKey(masterPassword, salt)
    const { iv, ciphertext } = await encryptText(setupKey, VERIFIER_SENTINEL)

    // 잠금 해제: 동일 비밀번호로 재도출 후 검증
    const unlockKey = await deriveKey(masterPassword, salt)
    const verified = await decryptText(unlockKey, iv, ciphertext)
    expect(verified).toBe(VERIFIER_SENTINEL)
  })

  test('잘못된 비밀번호로 verifier 검증 실패', async () => {
    const salt = randomSaltHex()
    const setupKey = await deriveKey('CorrectPassword1!', salt)
    const { iv, ciphertext } = await encryptText(setupKey, VERIFIER_SENTINEL)

    const wrongKey = await deriveKey('WrongPassword1!', salt)
    await expect(decryptText(wrongKey, iv, ciphertext)).rejects.toThrow()
  })

  test('자격증명 저장 → 재도출 키로 복구', async () => {
    const salt = randomSaltHex()
    const password = 'VaultPassword1!'
    const credentials = [
      { name: 'GitHub', value: 'gh_token_abc123' },
      { name: 'Bitcoin Wallet', value: 'word1 word2 word3 word4 word5 word6 word7 word8 word9 word10 word11 word12' },
    ]

    // 저장
    const writeKey = await deriveKey(password, salt)
    const encrypted = await Promise.all(
      credentials.map(c => encryptText(writeKey, c.value))
    )

    // 세션 후 재도출
    const readKey = await deriveKey(password, salt)
    const decrypted = await Promise.all(
      encrypted.map(({ iv, ciphertext }) => decryptText(readKey, iv, ciphertext))
    )

    expect(decrypted[0]).toBe('gh_token_abc123')
    expect(decrypted[1]).toBe(credentials[1].value)
  })
})
