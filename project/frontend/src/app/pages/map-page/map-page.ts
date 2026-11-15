import { Component } from '@angular/core';

import { Item } from '../../models/item.model';

import { Header } from '../../components/header/header';
import { ItemCard } from '../../components/item-card/item-card';
import { MOCK_ITEMS } from '../../models/mock-items';
import { Footer } from '../../components/footer/footer';
import en from '../../../assets/en.json';
import lv from '../../../assets/lv.json';
import { Router } from '@angular/router';

@Component({
  selector: 'app-map-page',
  standalone: true,
  imports: [Header, ItemCard, Footer],
  templateUrl: './map-page.html',
  styleUrl: './map-page.scss',
})
export class MapPageComponent {
  items: Item[] = MOCK_ITEMS;
  texts = en;
  constructor(private router: Router) {}
  openTerms() {
    this.router.navigate(['/terms']);
  }
}
