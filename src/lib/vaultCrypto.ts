const ITERATIONS = 310000
const SESSION_KEY = 'vault-session-key'

export async function deriveKey(password: string, saltHex: string): Promise<CryptoKey> {
  const salt = hexToBytes(saltHex)
  const enc = new TextEncoder()
  const keyMaterial = await crypto.subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, ['deriveKey'])
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt, iterations: ITERATIONS, hash: 'SHA-256' },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    true, // sessionStorage 저장을 위해 exportable
    ['encrypt', 'decrypt']
  )
}

export async function encryptText(key: CryptoKey, plaintext: string): Promise<{ iv: string; ciphertext: string }> {
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const enc = new TextEncoder()
  const buf = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, enc.encode(plaintext))
  return { iv: bytesToB64(iv), ciphertext: bytesToB64(new Uint8Array(buf)) }
}

export async function decryptText(key: CryptoKey, iv: string, ciphertext: string): Promise<string> {
  const ivBuf = b64ToBytes(iv)
  const ciphBuf = b64ToBytes(ciphertext)
  const plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: ivBuf }, key, ciphBuf)
  return new TextDecoder().decode(plain)
}

export function randomSaltHex(): string {
  return bytesToHex(crypto.getRandomValues(new Uint8Array(16)))
}

/** 잠금 해제 후 탭 세션 동안 키를 유지하기 위해 sessionStorage에 저장 */
export async function saveKeyToSession(key: CryptoKey): Promise<void> {
  const raw = await crypto.subtle.exportKey('raw', key)
  sessionStorage.setItem(SESSION_KEY, bytesToB64(new Uint8Array(raw)))
}

/** 페이지 재방문 시 sessionStorage에서 키 복원 (탭 닫으면 자동 소멸) */
export async function loadKeyFromSession(): Promise<CryptoKey | null> {
  const b64 = sessionStorage.getItem(SESSION_KEY)
  if (!b64) return null
  try {
    const raw = b64ToBytes(b64)
    return await crypto.subtle.importKey('raw', raw, { name: 'AES-GCM', length: 256 }, true, ['encrypt', 'decrypt'])
  } catch {
    sessionStorage.removeItem(SESSION_KEY)
    return null
  }
}

/** 잠금 시 세션 키 삭제 */
export function clearKeyFromSession(): void {
  sessionStorage.removeItem(SESSION_KEY)
}

function bytesToB64(buf: Uint8Array): string {
  return btoa(String.fromCharCode(...buf))
}
function b64ToBytes(b64: string): Uint8Array<ArrayBuffer> {
  return Uint8Array.from(atob(b64), c => c.charCodeAt(0)) as Uint8Array<ArrayBuffer>
}
function hexToBytes(hex: string): Uint8Array<ArrayBuffer> {
  const arr = new Uint8Array(hex.length / 2)
  for (let i = 0; i < arr.length; i++) arr[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16)
  return arr as Uint8Array<ArrayBuffer>
}
function bytesToHex(buf: Uint8Array): string {
  return Array.from(buf).map(b => b.toString(16).padStart(2, '0')).join('')
}
