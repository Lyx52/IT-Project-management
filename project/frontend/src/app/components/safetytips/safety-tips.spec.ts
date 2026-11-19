import { ComponentFixture, TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { safetyTips } from './safety-tips';

describe('safetyTips', () => {
  let fixture: ComponentFixture<safetyTips>;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    fixture = TestBed.createComponent(safetyTips);
    fixture.detectChanges();
  });

  const host = () => fixture.nativeElement as HTMLElement;

  it('offers Hide rather than Collapse', () => {
    const button = host().querySelector<HTMLButtonElement>('.safety-tips-hide')!;

    // "Collapse" suggested it would fold to a smaller version; it disappears
    expect(button.textContent?.trim()).toBe('Hide');
    expect(host().textContent).not.toContain('Collapse');
  });

  it('asks to be hidden when the button is pressed', () => {
    const emitted = vi.fn();
    fixture.componentInstance.collapseRequested.subscribe(emitted);

    host().querySelector<HTMLButtonElement>('.safety-tips-hide')!.click();

    expect(emitted).toHaveBeenCalledOnce();
  });

  it('is announced as a note, not as page furniture', () => {
    const panel = host().querySelector('.safety-tips')!;

    expect(panel.getAttribute('role')).toBe('note');
    expect(panel.getAttribute('aria-labelledby')).toBe('safety-tips-title');
  });

  it('keeps the advice short enough not to need a scrollbar', () => {
    // The panel used to cap its height and scroll, inside a sidebar
    expect(host().querySelectorAll('.safety-tips-list li')).toHaveLength(5);
    expect(getComputedStyle(host().querySelector('.safety-tips-list')!).overflowY).not.toBe(
      'scroll',
    );
  });
});
