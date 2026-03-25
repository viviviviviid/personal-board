const ITERATIONS = 310000

export async function deriveKey(password: string, saltHex: string): Promise<CryptoKey> {
  const salt = hexToBytes(saltHex)
  const enc = new TextEncoder()
  const keyMaterial = await crypto.subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, ['deriveKey'])
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt, iterations: ITERATIONS, hash: 'SHA-256' },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
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

function bytesToB64(buf: Uint8Array): string {
  return btoa(String.fromCharCode(...buf))
}
function b64ToBytes(b64: string): Uint8Array {
  return Uint8Array.from(atob(b64), c => c.charCodeAt(0))
}
function hexToBytes(hex: string): Uint8Array {
  const arr = new Uint8Array(hex.length / 2)
  for (let i = 0; i < arr.length; i++) arr[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16)
  return arr
}
function bytesToHex(buf: Uint8Array): string {
  return Array.from(buf).map(b => b.toString(16).padStart(2, '0')).join('')
}
