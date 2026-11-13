import { Component, inject } from '@angular/core';
import { ActivatedRoute } from '@angular/router';

import { Item } from '../../models/item.model';
import { Terms } from '../../components/terms/terms';
import { Footer } from '../../components/footer/footer';
import { Header } from '../../components/header/header';
import { ItemCard } from '../../components/item-card/item-card';
import { MOCK_ITEMS } from '../../models/mock-items';
import { ItemForm } from '../../components/item-form/item-form';
import { Messenger } from '../../components/messenger/messenger';
import en from '../../../assets/en.json';
import lv from '../../../assets/lv.json';

@Component({
  selector: 'app-items-page',
  standalone: true,
  imports: [Header, ItemCard, ItemForm, Messenger,Footer, Terms],
  templateUrl: './items-page.html',
  styleUrl: './items-page.scss',
})
export class ItemsPageComponent {
  private route = inject(ActivatedRoute);
 texts = en;

  items: Item[] = MOCK_ITEMS;

  selectedType: 'LOST' | 'FOUND' = 'LOST';

  isCreatePostOpen = false;
  isMessengerOpen = false;
 isVisible = false;
  showTerms(): void {
    this.isVisible = true;
  }
  hideTerms(): void {
    this.isVisible = false;
  }
  get filteredItems(): Item[] {
    return this.items.filter((item) => item.type === this.selectedType);
  }

  selectType(type: 'LOST' | 'FOUND'): void {
    this.selectedType = type;
  }

  openCreatePost(): void {
    this.isCreatePostOpen = true;
  }

  closeCreatePost(): void {
    this.isCreatePostOpen = false;
  }

  toggleMessenger(): void {
    this.isMessengerOpen = !this.isMessengerOpen;
  }
}
