/**
 * Application-level encryption for sensitive signature data.
 *
 * Uses AES-256-GCM via Web Crypto API to encrypt signature image data
 * before storage in the database. This provides defense-in-depth beyond
 * Convex's built-in encryption at rest.
 *
 * Encrypted data is stored as: `enc:v1:<iv-hex>:<ciphertext-base64>`
 * The prefix allows detection of encrypted vs plaintext data for
 * backward compatibility with existing unencrypted signatures.
 *
 * Key: SIGNATURE_ENCRYPTION_KEY environment variable (base64-encoded 256-bit key)
 */

const ENCRYPTION_PREFIX = "enc:v1:";

/**
 * Derive an AES-256-GCM CryptoKey from a base64-encoded key string.
 */
async function getEncryptionKey(keyBase64: string): Promise<CryptoKey> {
  const keyBytes = Uint8Array.from(atob(keyBase64), (c) => c.charCodeAt(0));
  return crypto.subtle.importKey("raw", keyBytes, { name: "AES-GCM" }, false, [
    "encrypt",
    "decrypt",
  ]);
}

/**
 * Encrypt a string value using AES-256-GCM.
 *
 * Returns the encrypted value prefixed with `enc:v1:<iv>:` for identification.
 * If no encryption key is configured, returns the plaintext value unchanged
 * (graceful degradation for development environments).
 *
 * @param plaintext - The value to encrypt
 * @param keyBase64 - Base64-encoded 256-bit encryption key
 * @returns Encrypted string in format `enc:v1:<iv-hex>:<ciphertext-base64>`
 */
export async function encryptSignatureData(
  plaintext: string | undefined,
  keyBase64: string | undefined
): Promise<string | undefined> {
  if (!plaintext || !keyBase64) return plaintext;

  const key = await getEncryptionKey(keyBase64);
  const encoder = new TextEncoder();
  const data = encoder.encode(plaintext);

  // Generate random 12-byte IV (standard for AES-GCM)
  const iv = crypto.getRandomValues(new Uint8Array(12));

  const ciphertext = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    key,
    data
  );

  // Encode IV as hex, ciphertext as base64
  const ivHex = Array.from(iv, (b) => b.toString(16).padStart(2, "0")).join("");
  const ctBase64 = btoa(String.fromCharCode(...new Uint8Array(ciphertext)));

  return `${ENCRYPTION_PREFIX}${ivHex}:${ctBase64}`;
}

/**
 * Decrypt a previously encrypted string value.
 *
 * If the value doesn't have the encryption prefix, it's assumed to be
 * plaintext (backward compatibility) and returned as-is.
 *
 * @param encrypted - The encrypted value (or plaintext for backward compat)
 * @param keyBase64 - Base64-encoded 256-bit encryption key
 * @returns Decrypted plaintext string
 */
export async function decryptSignatureData(
  encrypted: string | undefined,
  keyBase64: string | undefined
): Promise<string | undefined> {
  if (!encrypted) return encrypted;

  // If no encryption key or data isn't encrypted, return as-is (backward compat)
  if (!keyBase64 || !encrypted.startsWith(ENCRYPTION_PREFIX)) {
    return encrypted;
  }

  // Parse: enc:v1:<iv-hex>:<ciphertext-base64>
  const withoutPrefix = encrypted.slice(ENCRYPTION_PREFIX.length);
  const colonIdx = withoutPrefix.indexOf(":");
  if (colonIdx === -1) return encrypted; // Malformed, return as-is

  const ivHex = withoutPrefix.slice(0, colonIdx);
  const ctBase64 = withoutPrefix.slice(colonIdx + 1);

  const key = await getEncryptionKey(keyBase64);

  // Decode IV from hex
  const iv = new Uint8Array(ivHex.length / 2);
  for (let i = 0; i < iv.length; i++) {
    iv[i] = parseInt(ivHex.slice(i * 2, i * 2 + 2), 16);
  }

  // Decode ciphertext from base64
  const ctBytes = Uint8Array.from(atob(ctBase64), (c) => c.charCodeAt(0));

  const plaintext = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv },
    key,
    ctBytes
  );

  return new TextDecoder().decode(plaintext);
}

/**
 * Check if a value is encrypted (has the encryption prefix).
 */
export function isEncrypted(value: string | undefined): boolean {
  return !!value && value.startsWith(ENCRYPTION_PREFIX);
}
