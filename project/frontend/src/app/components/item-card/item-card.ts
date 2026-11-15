import { Component, Input } from '@angular/core';
import { Item } from '../../models/models';
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

  imageFailed = false;

  onImageError(): void {
    this.imageFailed = true;
  }
}
