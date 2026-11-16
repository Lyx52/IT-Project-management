import { Component, Input } from '@angular/core';
import { Item } from '../../models/models';
import en from '../../../assets/en.json';
import lv from '../../../assets/lv.json';
import { DatePipe } from '@angular/common';

@Component({
  selector: 'app-item-card',
  imports: [DatePipe],
  templateUrl: './item-card.html',
  styleUrl: './item-card.scss',
})
export class ItemCard {
  @Input({ required: true }) item!: Item;
  texts = en;

  imageFailed = false;

  onImageError(): void {
    this.imageFailed = true;
  }
}
