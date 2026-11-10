import { Component, inject } from '@angular/core';
import { ActivatedRoute } from '@angular/router';

import { Item } from '../../models/item.model';

import { Header } from '../../components/header/header';
import { ItemCard } from '../../components/item-card/item-card';
import { MOCK_ITEMS } from '../../models/mock-items';
import { ItemFilters, ItemFilterValues } from '../../components/item-filters/item-filters';

@Component({
  selector: 'app-items-page',
  standalone: true,
  imports: [Header, ItemCard, ItemFilters],
  templateUrl: './items-page.html',
  styleUrl: './items-page.scss',
})
export class ItemsPageComponent {
  private route = inject(ActivatedRoute);

  items: Item[] = MOCK_ITEMS;
  type: 'LOST' | 'FOUND' = 'LOST';
  filters: ItemFilterValues = { category: '', dateFrom: '', dateTo: '' };

  onFiltersChange(filters: ItemFilterValues): void {
    this.filters = filters;
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
