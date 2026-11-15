import { lastValueFrom, toArray } from 'rxjs';
import { describe, expect, it } from 'vitest';
import { CaptchaSolver } from './captcha-solver';
import { PowProblem, searchRange, solve } from './pow';
import { sha256Hex } from './sha256';

const SALT = '0f1e2d3c4b5a69788796a5b4';

/** A puzzle whose answer is `n`, built the same way the backend builds one. */
const puzzle = (n: number, maxNumber: number): PowProblem => ({
  salt: SALT,
  challenge: sha256Hex(SALT + n),
  maxNumber,
});

describe('sha256Hex', () => {
  it('matches the standard test vectors', () => {
    expect(sha256Hex('')).toBe('e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855');
    expect(sha256Hex('abc')).toBe(
      'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad',
    );
    // 55 bytes, the longest input that fits one block
    expect(sha256Hex('a'.repeat(55))).toBe(
      '9f4390f8d30c2dd92ec9f095b65e2b9ae9b0a925a5258e241c9f1e910f734318',
    );
  });

  it('refuses input that needs more than one block', () => {
    expect(() => sha256Hex('a'.repeat(56))).toThrow(RangeError);
  });
});

describe('proof-of-work search', () => {
  it('finds the secret number anywhere in the range, including both ends', () => {
    for (const n of [0, 1, 9, 10, 4321, 9999, 10000]) {
      expect(solve(puzzle(n, 10_000))).toBe(n);
    }
  });

  it('returns null when the number is outside the range', () => {
    expect(solve(puzzle(20_001, 20_000))).toBeNull();
    expect(searchRange(puzzle(50, 100), 0, 49)).toBeNull();
    expect(searchRange(puzzle(50, 100), 50, 100)).toBe(50);
  });

  it('reports progress up to the whole range', () => {
    const reported: number[] = [];

    solve(puzzle(120_000, 120_000), (fraction) => reported.push(fraction));

    expect(reported.length).toBeGreaterThan(1);
    expect(reported).toEqual([...reported].sort((a, b) => a - b));
    expect(reported[reported.length - 1]).toBeLessThanOrEqual(1);
  });

  it('rejects a salt that would not fit one block', () => {
    expect(() => solve({ ...puzzle(1, 10), salt: 'x'.repeat(40) })).toThrow();
  });
});

describe('CaptchaSolver', () => {
  // jsdom has no Web Worker, so this covers the main-thread fallback
  it('solves on the main thread when Web Workers are unavailable', async () => {
    const events = await lastValueFrom(
      new CaptchaSolver().solve(puzzle(123_456, 200_000)).pipe(toArray()),
    );

    expect(events[events.length - 1]).toEqual({ type: 'solved', number: 123_456 });
    expect(events.filter((e) => e.type === 'progress').length).toBeGreaterThan(0);
  });

  it('errors when no number matches', async () => {
    await expect(lastValueFrom(new CaptchaSolver().solve(puzzle(500, 100)))).rejects.toThrow(
      'No number matches',
    );
  });
});
