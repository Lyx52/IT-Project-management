import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { PowProblem, SLICE_SIZE, searchRange } from './pow';

export type SolveEvent =
  { type: 'progress'; fraction: number } | { type: 'solved'; number: number };

/**
 * Solves a proof-of-work CAPTCHA in the browser.
 *
 * The search runs in a Web Worker so typing in the form is never held up. The
 * observable emits progress, then one `solved` event and completes, or errors
 * if no number matches. Unsubscribing stops the work at once.
 */
@Injectable({ providedIn: 'root' })
export class CaptchaSolver {
  solve(problem: PowProblem): Observable<SolveEvent> {
    return typeof Worker === 'undefined' ? this.solveInline(problem) : this.solveInWorker(problem);
  }

  private solveInWorker(problem: PowProblem): Observable<SolveEvent> {
    return new Observable<SolveEvent>((subscriber) => {
      const worker = new Worker(new URL('./pow.worker', import.meta.url), { type: 'module' });

      worker.onmessage = ({ data }: MessageEvent) => {
        if (data.type === 'progress') {
          subscriber.next({ type: 'progress', fraction: data.fraction });
        } else if (data.type === 'solved') {
          subscriber.next({ type: 'solved', number: data.number });
          subscriber.complete();
        } else {
          subscriber.error(new Error('No number matches the CAPTCHA challenge'));
        }
      };
      worker.onerror = (event) => {
        event.preventDefault();
        subscriber.error(new Error('The CAPTCHA worker failed'));
      };

      worker.postMessage(problem);

      return () => worker.terminate();
    });
  }

  /**
   * For browsers without Web Workers: the same search in slices on the main
   * thread, yielding between slices so the page can still repaint.
   */
  private solveInline(problem: PowProblem): Observable<SolveEvent> {
    return new Observable<SolveEvent>((subscriber) => {
      let from = 0;
      let timer: ReturnType<typeof setTimeout> | undefined;

      const step = () => {
        try {
          const to = Math.min(from + SLICE_SIZE - 1, problem.maxNumber);
          const found = searchRange(problem, from, to);

          if (found !== null) {
            subscriber.next({ type: 'solved', number: found });
            subscriber.complete();
            return;
          }

          if (to >= problem.maxNumber) {
            subscriber.error(new Error('No number matches the CAPTCHA challenge'));
            return;
          }

          from = to + 1;
          subscriber.next({ type: 'progress', fraction: from / (problem.maxNumber + 1) });
          timer = setTimeout(step);
        } catch (error) {
          subscriber.error(error);
        }
      };

      timer = setTimeout(step);

      return () => clearTimeout(timer);
    });
  }
}
