import { Component, EventEmitter, inject, Input, Output } from '@angular/core';
import { Item } from '../../models/models';
import en from '../../../assets/en.json';
import lv from '../../../assets/lv.json';
import { DatePipe } from '@angular/common';
import { AuthService } from '../../services/auth';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-item-card',
  imports: [DatePipe, RouterLink],
  templateUrl: './item-card.html',
  styleUrl: './item-card.scss',
})
export class ItemCard {
  @Input({ required: true }) item!: Item;
  @Output() edit = new EventEmitter<Item>();
  /** For the author's own list, where pending and rejected posts show up too. */
  @Input() showStatus = false;
  texts = en;

  private readonly auth = inject(AuthService);

  /** Only the author can edit, and not once the post is resolved. */
  get canEdit(): boolean {
    const user = this.auth.user();
    return !!user && user.id === this.item.user?.id && this.item.status !== 'resolved';
  }

  imageFailed = false;

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
