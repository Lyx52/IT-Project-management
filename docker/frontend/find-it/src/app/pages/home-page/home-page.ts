import { Component } from '@angular/core';
import { Item } from '../../models/item.model';
import { ItemForm } from '../../components/item-form/item-form';
import { ItemCard } from '../../components/item-card/item-card';
import { Messenger } from '../../components/messenger/messenger';
import { Header } from '../../components/header/header';

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

  items: Item[] = [
    {
      id: 1,
      name: 'Black Backpack',
      description: 'Black backpack with several books inside.',
      category: 'Accessories',
      location: 'Riga, University',
      date: '05 Nov 2026',
      type: 'LOST',
      icon: 'bi-backpack'
    },
    {
      id: 2,
      name: 'Set of Keys',
      description: 'Found a set of keys near the entrance.',
      category: 'Accessories',
      location: 'Riga, Centre',
      date: '05 Nov 2026',
      type: 'FOUND',
      icon: 'bi-key'
    },
    {
      id: 3,
      name: 'Wireless Headphones',
      description: 'White wireless headphones in a case.',
      category: 'Electronics',
      location: 'Riga, Shopping Centre',
      date: '04 Nov 2026',
      type: 'LOST',
      icon: 'bi-headphones'
    },
    {
      id: 4,
      name: 'Student ID Card',
      description: 'Student identification card.',
      category: 'Documents',
      location: 'Riga, University',
      date: '03 Nov 2026',
      type: 'FOUND',
      icon: 'bi-person-vcard'
    }
  ];

}
