import { Component, EventEmitter, inject, Input, Output } from '@angular/core';
import { Item } from '../../models/models';
import en from '../../../assets/en.json';
import lv from '../../../assets/lv.json';
import { DatePipe } from '@angular/common';
import { AuthService } from '../../services/auth';

@Component({
  selector: 'app-item-card',
  imports: [DatePipe],
  templateUrl: './item-card.html',
  styleUrl: './item-card.scss',
})
export class ItemCard {
  @Input({ required: true }) item!: Item;
  @Output() edit = new EventEmitter<Item>();
  texts = en;

  private readonly auth = inject(AuthService);

  /** Only the author can edit, and not once the post is resolved. */
  get canEdit(): boolean {
    const user = this.auth.user();
    return !!user && user.id === this.item.user?.id && this.item.status !== 'resolved';
  }

  imageFailed = false;

  onImageError(): void {
    this.imageFailed = true;
  }
}
