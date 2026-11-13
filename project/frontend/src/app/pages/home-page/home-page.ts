import { Component } from '@angular/core';
import { Item } from '../../models/item.model';
import { ItemForm } from '../../components/item-form/item-form';
import { ItemCard } from '../../components/item-card/item-card';
import { Messenger } from '../../components/messenger/messenger';
import { Header } from '../../components/header/header';
import { MOCK_ITEMS } from '../../models/mock-items';
import { Footer } from '../../components/footer/footer';
import { CookieNotice } from '../../components/cookie/cookie-notice';
import { Terms } from '../../components/terms/terms';
import en from '../../../assets/en.json';
import lv from '../../../assets/lv.json';

@Component({
  selector: 'app-home-page',
  standalone: true,
  imports: [ItemForm, ItemCard, Messenger, Header, Footer, CookieNotice, Terms],
  templateUrl: './home-page.html',
  styleUrl: './home-page.scss',
})
export class HomePageComponent {
  items: Item[] = MOCK_ITEMS;
 cookieVisible = false;
  texts = en;

  ngOnInit() {
    const alreadyShown = localStorage.getItem('cookieShown');

    if (!alreadyShown) {
      this.cookieVisible = true;
      localStorage.setItem('cookieShown', 'true');
    }
  }
  hidecookie(): void {
    this.cookieVisible = false;
  }

  isVisible = false;
  showTerms(): void {
    this.isVisible = true;
  }
  hideTerms(): void {
    this.isVisible = false;
  }
  isCreatePostOpen = false;
  isMessengerOpen = false;

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
