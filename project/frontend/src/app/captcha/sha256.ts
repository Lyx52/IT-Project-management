/**
 * Minimal synchronous SHA-256 for the proof-of-work CAPTCHA.
 *
 * `crypto.subtle.digest` is async and only exists in secure contexts, and
 * awaiting it a million times is far slower than hashing in a tight loop. The
 * CAPTCHA only ever hashes short ASCII strings, so this handles exactly that:
 * input of at most 55 bytes, which always fits a single 64-byte block.
 */

const K = new Uint32Array([
  0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
  0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
  0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
  0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
  0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
  0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
  0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
  0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
]);

/** Longest input that still fits one block with its padding and length. */
export const MAX_SINGLE_BLOCK_BYTES = 55;

const block = new Uint8Array(64);
const w = new Uint32Array(64);
const digest = new Uint32Array(8);

/**
 * Hashes `bytes[0..length)` and returns the digest as eight big-endian words.
 * The returned array is reused by the next call: copy it to keep it.
 */
export function sha256Words(bytes: Uint8Array, length: number): Uint32Array {
  if (length > MAX_SINGLE_BLOCK_BYTES) {
    throw new RangeError(`sha256Words handles at most ${MAX_SINGLE_BLOCK_BYTES} bytes`);
  }

  block.fill(0);
  block.set(bytes.subarray(0, length));
  block[length] = 0x80;
  // Bit length in the last 8 bytes; below 2^16 here, so two bytes suffice.
  const bits = length * 8;
  block[62] = bits >>> 8;
  block[63] = bits & 0xff;

  for (let i = 0; i < 16; i++) {
    const j = i * 4;
    w[i] = (block[j] << 24) | (block[j + 1] << 16) | (block[j + 2] << 8) | block[j + 3];
  }

  for (let i = 16; i < 64; i++) {
    const x = w[i - 15];
    const y = w[i - 2];
    const s0 = ((x >>> 7) | (x << 25)) ^ ((x >>> 18) | (x << 14)) ^ (x >>> 3);
    const s1 = ((y >>> 17) | (y << 15)) ^ ((y >>> 19) | (y << 13)) ^ (y >>> 10);
    w[i] = (w[i - 16] + s0 + w[i - 7] + s1) | 0;
  }

  let a = 0x6a09e667;
  let b = 0xbb67ae85;
  let c = 0x3c6ef372;
  let d = 0xa54ff53a;
  let e = 0x510e527f;
  let f = 0x9b05688c;
  let g = 0x1f83d9ab;
  let h = 0x5be0cd19;

  for (let i = 0; i < 64; i++) {
    const S1 = ((e >>> 6) | (e << 26)) ^ ((e >>> 11) | (e << 21)) ^ ((e >>> 25) | (e << 7));
    const ch = (e & f) ^ (~e & g);
    const t1 = (h + S1 + ch + K[i] + w[i]) | 0;
    const S0 = ((a >>> 2) | (a << 30)) ^ ((a >>> 13) | (a << 19)) ^ ((a >>> 22) | (a << 10));
    const maj = (a & b) ^ (a & c) ^ (b & c);
    const t2 = (S0 + maj) | 0;

    h = g;
    g = f;
    f = e;
    e = (d + t1) | 0;
    d = c;
    c = b;
    b = a;
    a = (t1 + t2) | 0;
  }

  digest[0] = (0x6a09e667 + a) | 0;
  digest[1] = (0xbb67ae85 + b) | 0;
  digest[2] = (0x3c6ef372 + c) | 0;
  digest[3] = (0xa54ff53a + d) | 0;
  digest[4] = (0x510e527f + e) | 0;
  digest[5] = (0x9b05688c + f) | 0;
  digest[6] = (0x1f83d9ab + g) | 0;
  digest[7] = (0x5be0cd19 + h) | 0;

  return digest;
}

/** Parses a 64-character hex digest into eight big-endian words. */
export function hexToWords(hex: string): Uint32Array {
  if (!/^[0-9a-f]{64}$/i.test(hex)) {
    throw new Error('Expected a SHA-256 digest as 64 hex characters');
  }

  const words = new Uint32Array(8);

  for (let i = 0; i < 8; i++) {
    words[i] = parseInt(hex.slice(i * 8, i * 8 + 8), 16);
  }

  return words;
}

/** Convenience for tests and one-off use: SHA-256 of a short ASCII string, as hex. */
export function sha256Hex(text: string): string {
  const bytes = new Uint8Array(text.length);

  for (let i = 0; i < text.length; i++) {
    bytes[i] = text.charCodeAt(i);
  }

  return Array.from(sha256Words(bytes, bytes.length), (word) =>
    (word >>> 0).toString(16).padStart(8, '0'),
  ).join('');
}
