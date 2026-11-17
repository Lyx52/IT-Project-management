import { Component, Input } from '@angular/core';
import { Item } from '../../models/models';
import en from '../../../assets/en.json';
import lv from '../../../assets/lv.json';
import { DatePipe } from '@angular/common';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-item-card',
  imports: [DatePipe, RouterLink],
  templateUrl: './item-card.html',
  styleUrl: './item-card.scss',
})
export class ItemCard {
  @Input({ required: true }) item!: Item;
  /** For the author's own list, where pending and rejected posts show up too. */
  @Input() showStatus = false;
  texts = en;

  imageFailed = false;
  reasonOpen = false;

  /** Rejected posts with a reason turn the status pill into a button. */
  get hasReason(): boolean {
    return this.item.status === 'rejected' && !!this.item.rejection_reason;
  }

  toggleReason(): void {
    this.reasonOpen = !this.reasonOpen;
  }

  /** "350 m" or "1.4 km", for suggested matches. */
  get distance(): string | null {
    const metres = this.item.distance_m;

    if (metres === undefined || metres === null) {
      return null;
    }

    return metres < 1000 ? `${Math.round(metres)} m` : `${(metres / 1000).toFixed(1)} km`;
  }

  onImageError(): void {
    this.imageFailed = true;
  }
}
