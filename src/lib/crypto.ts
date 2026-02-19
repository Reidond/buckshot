/**
 * AES-256-GCM encryption/decryption using Web Crypto API.
 * Compatible with Cloudflare Workers runtime.
 *
 * Format: base64(iv):base64(ciphertext):base64(authTag)
 * Key: 32-byte hex string (64 hex chars)
 */

function hexToBytes(hex: string): Uint8Array<ArrayBuffer> {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) {
    bytes[i / 2] = parseInt(hex.slice(i, i + 2), 16);
  }
  return bytes as Uint8Array<ArrayBuffer>;
}

function bytesToBase64(bytes: Uint8Array): string {
  return btoa(String.fromCharCode(...bytes));
}

function base64ToBytes(base64: string): Uint8Array<ArrayBuffer> {
  return Uint8Array.from(atob(base64), (c) => c.charCodeAt(0)) as Uint8Array<ArrayBuffer>;
}

async function getKey(hexKey: string): Promise<CryptoKey> {
  const keyBytes = hexToBytes(hexKey);
  return crypto.subtle.importKey("raw", keyBytes, { name: "AES-GCM" }, false, [
    "encrypt",
    "decrypt",
  ]);
}

export async function encrypt(plaintext: string, hexKey: string): Promise<string> {
  const key = await getKey(hexKey);
  const iv = crypto.getRandomValues(new Uint8Array(12)); // 96-bit IV for GCM
  const encoded = new TextEncoder().encode(plaintext);

  const ciphertext = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, encoded);

  // AES-GCM appends 16-byte auth tag to ciphertext
  const ciphertextBytes = new Uint8Array(ciphertext);

  return `${bytesToBase64(iv)}:${bytesToBase64(ciphertextBytes)}`;
}

export async function decrypt(encrypted: string, hexKey: string): Promise<string> {
  const parts = encrypted.split(":");
  if (parts.length !== 2) {
    throw new Error("Invalid encrypted format");
  }
  const [ivB64, ciphertextB64] = parts as [string, string];

  const key = await getKey(hexKey);
  const iv = base64ToBytes(ivB64);
  const ciphertext = base64ToBytes(ciphertextB64);

  const plaintext = await crypto.subtle.decrypt({ name: "AES-GCM", iv }, key, ciphertext);

  return new TextDecoder().decode(plaintext);
}
