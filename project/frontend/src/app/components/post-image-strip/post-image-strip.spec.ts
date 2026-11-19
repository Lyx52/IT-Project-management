import { ComponentFixture, TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it } from 'vitest';
import { ItemImage } from '../../models/models';
import { PostImageStrip } from './post-image-strip';

const IMAGES: ItemImage[] = [
  { id: 1, url: 'http://localhost:8001/storage/posts/1/a.png' },
  { id: 2, url: 'http://localhost:8001/storage/posts/1/b.png' },
];

describe('PostImageStrip', () => {
  let fixture: ComponentFixture<PostImageStrip>;
  let component: PostImageStrip;

  const setup = (images: ItemImage[]) => {
    TestBed.configureTestingModule({});

    fixture = TestBed.createComponent(PostImageStrip);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('images', images);
    fixture.detectChanges();
  };

  const root = () => fixture.nativeElement as HTMLElement;

  beforeEach(() => TestBed.resetTestingModule());

  it('renders a thumbnail per image', () => {
    setup(IMAGES);

    const thumbs = root().querySelectorAll('.thumb img');

    expect(thumbs.length).toBe(2);
    expect(thumbs[0].getAttribute('src')).toBe(IMAGES[0].url);
  });

  it('says so when a post has no photos, which moderators need to know', () => {
    setup([]);

    expect(component.hasImages()).toBe(false);
    expect(root().textContent).toContain('No photos attached');
    expect(root().querySelectorAll('.thumb').length).toBe(0);
  });

  it('enlarges an image on click', () => {
    setup(IMAGES);

    (root().querySelector('.thumb') as HTMLButtonElement).click();
    fixture.detectChanges();

    expect(component.enlarged()).toEqual(IMAGES[0]);
    expect(root().querySelector('.viewer-image')?.getAttribute('src')).toBe(IMAGES[0].url);
  });

  it('closes the enlarged view', () => {
    setup(IMAGES);
    component.enlarge(IMAGES[1]);
    fixture.detectChanges();

    component.close();
    fixture.detectChanges();

    expect(component.enlarged()).toBeNull();
    expect(root().querySelector('.viewer-image')).toBeNull();
  });

  it('marks an image that will not load, instead of showing a blank box', () => {
    setup(IMAGES);

    const img = root().querySelector('.thumb img') as HTMLImageElement;
    img.dispatchEvent(new Event('error'));
    fixture.detectChanges();

    expect(component.hasFailed(IMAGES[0])).toBe(true);
    expect(root().querySelectorAll('.thumb-broken').length).toBe(1);
  });

  it('will not enlarge a broken image', () => {
    setup(IMAGES);

    component.onError(IMAGES[0]);
    component.enlarge(IMAGES[0]);

    expect(component.enlarged()).toBeNull();
  });

  it('records each failure only once', () => {
    setup(IMAGES);

    component.onError(IMAGES[0]);
    component.onError(IMAGES[0]);

    expect(component.failedIds()).toEqual([1]);
  });
});
