import { Item } from '../models/item.model';

export const MOCK_ITEMS: Item[] = [
  {
    id: 1,
    name: 'Black Backpack',
    description: 'Black backpack with several books inside.',
    category: 'Accessories',
    location: 'Riga, University',
    date: '05 Nov 2026',
    type: 'LOST',
    icon: 'bi-backpack',
  },
  {
    id: 2,
    name: 'Set of Keys',
    description: 'Found a set of keys near the entrance.',
    category: 'Accessories',
    location: 'Riga, Centre',
    date: '05 Nov 2026',
    type: 'FOUND',
    icon: 'bi-key',
  },
  {
    id: 3,
    name: 'Wireless Headphones',
    description: 'White wireless headphones in a case.',
    category: 'Electronics',
    location: 'Riga, Shopping Centre',
    date: '04 Nov 2026',
    type: 'LOST',
    icon: 'bi-headphones',
  },
  {
    id: 4,
    name: 'Student ID Card',
    description: 'Student identification card.',
    category: 'Documents',
    location: 'Riga, University',
    date: '03 Nov 2026',
    type: 'FOUND',
    icon: 'bi-person-vcard',
  },
];
