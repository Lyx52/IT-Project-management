import { Component } from '@angular/core';

import { Item } from '../../models/models';

import { Header } from '../../components/header/header';
import { ItemCard } from '../../components/item-card/item-card';
import { MOCK_ITEMS } from '../../models/mock-items';

@Component({
  selector: 'app-map-page',
  standalone: true,
  imports: [Header, ItemCard],
  templateUrl: './map-page.html',
  styleUrl: './map-page.scss',
})
export class MapPageComponent {
  items: Item[] = MOCK_ITEMS;
}
