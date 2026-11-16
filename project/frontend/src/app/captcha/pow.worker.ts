/**
 * Runs the CAPTCHA search off the main thread, so the form stays responsive
 * while the browser works. Started and stopped by CaptchaSolver.
 *
 * In:  PowProblem
 * Out: { type: 'progress', fraction } while searching,
 *      then { type: 'solved', number } or { type: 'failed' }
 */
import { PowProblem, solve } from './pow';

addEventListener('message', ({ data }: MessageEvent<PowProblem>) => {
  try {
    const number = solve(data, (fraction) => postMessage({ type: 'progress', fraction }));

    postMessage(number === null ? { type: 'failed' } : { type: 'solved', number });
  } catch {
    postMessage({ type: 'failed' });
  }
});
