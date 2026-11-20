import { Component, computed, input, signal } from '@angular/core';
import { ItemImage } from '../../models/models';

/**
 * Thumbnails of a post's photos, with click to enlarge.
 *
 * Built for the moderation screens, where the image is often the thing being
 * judged, so it has to be inspectable at full size without leaving the queue.
 */
@Component({
  selector: 'app-post-image-strip',
  imports: [],
  templateUrl: './post-image-strip.html',
  styleUrl: './post-image-strip.scss',
})
export class PostImageStrip {
  readonly images = input<ItemImage[]>([]);
  /** Shown when a post has no photos, which is itself worth knowing. */
  readonly emptyLabel = input('No photos attached');

  /** The enlarged image, or null when the viewer is closed. */
  readonly enlarged = signal<ItemImage | null>(null);
  /** Ids whose file could not be loaded, so a broken image is obvious. */
  readonly failedIds = signal<number[]>([]);

  readonly hasImages = computed(() => this.images().length > 0);

  hasFailed(image: ItemImage): boolean {
    return this.failedIds().includes(image.id);
  }

  onError(image: ItemImage): void {
    this.failedIds.update((ids) => (ids.includes(image.id) ? ids : [...ids, image.id]));
  }

  enlarge(image: ItemImage): void {
    if (!this.hasFailed(image)) {
      this.enlarged.set(image);
    }
  }

  close(): void {
    this.enlarged.set(null);
  }
}
