export interface Item {
  id: number;
  name: string;
  description: string;
  category: string;
  location: string;
  date: string;
  type: 'LOST' | 'FOUND';
  icon: string;
}