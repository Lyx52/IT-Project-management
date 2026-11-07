import { Component } from '@angular/core';
import { Item } from '../../models/item.model';
import { ItemForm } from '../../components/item-form/item-form';
import { ItemCard } from '../../components/item-card/item-card';
import { Messenger } from '../../components/messenger/messenger';
import { Header } from '../../components/header/header';
import { MOCK_ITEMS } from '../../models/mock-items';

@Component({
  selector: 'app-home-page',
  standalone: true,
  imports: [
    ItemForm,
    ItemCard,
    Messenger,
    Header
],
  templateUrl: './home-page.html',
  styleUrl: './home-page.scss'
})
export class HomePageComponent {

  items: Item[] = MOCK_ITEMS;

}
