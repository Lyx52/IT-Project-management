import { MAX_SINGLE_BLOCK_BYTES, hexToWords, sha256Words } from './sha256';

/**
 * The puzzle from GET /api/v1/captcha: find the whole number n in
 * 0..maxNumber for which SHA-256(salt + n) equals `challenge`, with n written
 * in plain decimal. The server picked n at random, so on average half the
 * range is searched, and never more than all of it.
 */
export interface PowProblem {
  salt: string;
  challenge: string;
  maxNumber: number;
}

/** Longest decimal number the puzzle can use (Number.MAX_SAFE_INTEGER). */
const MAX_DIGITS = 16;

/**
 * Searches `from..to` (both inclusive) and returns the number whose hash
 * matches, or null if it is not in that slice. Callers split the full range
 * into slices to report progress and stay cancellable.
 */
export function searchRange(problem: PowProblem, from: number, to: number): number | null {
  const { salt } = problem;

  if (!/^[\x21-\x7e]*$/.test(salt) || salt.length + MAX_DIGITS > MAX_SINGLE_BLOCK_BYTES) {
    throw new Error('Unsupported CAPTCHA salt');
  }

  const target = hexToWords(problem.challenge);
  // Both are Uint32Arrays, so the words compare as unsigned numbers
  const t0 = target[0];
  const bytes = new Uint8Array(MAX_SINGLE_BLOCK_BYTES);

  for (let i = 0; i < salt.length; i++) {
    bytes[i] = salt.charCodeAt(i);
  }

  const digits = new Uint8Array(MAX_DIGITS);

  for (let n = from; n <= to; n++) {
    // Decimal digits of n, written straight after the salt
    let length = 0;
    let rest = n;

    do {
      digits[length++] = 48 + (rest % 10);
      rest = Math.floor(rest / 10);
    } while (rest > 0);

    let end = salt.length;

    for (let i = length - 1; i >= 0; i--) {
      bytes[end++] = digits[i];
    }

    const hash = sha256Words(bytes, end);

    // The first word rules out all but one in four billion, so the rest is
    // compared only on a hit
    if (hash[0] === t0 && hash.every((word, i) => word === target[i])) {
      return n;
    }
  }

  return null;
}

/** Hashes per slice: small enough to report progress and cancel often. */
export const SLICE_SIZE = 50_000;

/**
 * Searches the whole range synchronously. Blocks the thread it runs on, so
 * the page uses this only inside a Web Worker (see pow.worker.ts).
 */
export function solve(problem: PowProblem, onProgress?: (fraction: number) => void): number | null {
  for (let from = 0; from <= problem.maxNumber; from += SLICE_SIZE) {
    const to = Math.min(from + SLICE_SIZE - 1, problem.maxNumber);
    const found = searchRange(problem, from, to);

    if (found !== null) {
      return found;
    }

    onProgress?.((to + 1) / (problem.maxNumber + 1));
  }

  return null;
}
