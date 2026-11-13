import { Component, inject } from '@angular/core';
import { ActivatedRoute } from '@angular/router';

import { Item } from '../../models/item.model';

import { Terms } from '../../components/terms/terms';
import { Footer } from '../../components/footer/footer';
import { Header } from '../../components/header/header';
import { ItemCard } from '../../components/item-card/item-card';
import { MOCK_ITEMS } from '../../models/mock-items';
import en from '../../../assets/en.json';
import lv from '../../../assets/lv.json';

@Component({
  selector: 'app-items-page',
  standalone: true,
  imports: [Header, ItemCard, Footer, Terms],
  templateUrl: './items-page.html',
  styleUrl: './items-page.scss',
})
export class ItemsPageComponent {
  private route = inject(ActivatedRoute);
  texts = en;

  items: Item[] = MOCK_ITEMS;
  type: 'LOST' | 'FOUND' = 'LOST';
  isVisible = false;
  showTerms(): void {
    this.isVisible = true;
  }
  hideTerms(): void {
    this.isVisible = false;
  }
  constructor() {
    this.route.data.subscribe((data) => {
      this.type = data['type'];
    });
  }
  get pageTitle(): string {
    return this.type === 'LOST' ? 'Lost items' : 'Found items';
  }

  get pageDescription(): string {
    return this.type === 'LOST'
      ? 'Browse items that people have lost.'
      : 'Browse items that people have found.';
  }

  get filteredItems(): Item[] {
    return this.items.filter((item) => item.type === this.type);
  }
}
