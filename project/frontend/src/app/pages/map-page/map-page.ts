import { Component } from '@angular/core';

import { Item } from '../../models/item.model';

import { Terms } from '../../components/terms/terms';
import { Footer } from '../../components/footer/footer';
import { Header } from '../../components/header/header';
import { ItemCard } from '../../components/item-card/item-card';
import { MOCK_ITEMS } from '../../models/mock-items';
import en from '../../../assets/en.json';
import lv from '../../../assets/lv.json';

@Component({
  selector: 'app-map-page',
  standalone: true,
  imports: [Header, ItemCard, Footer, Terms],
  templateUrl: './map-page.html',
  styleUrl: './map-page.scss',
})
export class MapPageComponent {
  items: Item[] = MOCK_ITEMS;
  texts = en;
  isVisible = false;
  showTerms(): void {
    this.isVisible = true;
  }
  hideTerms(): void {
    this.isVisible = false;
  }
}
