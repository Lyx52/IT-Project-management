import { Component, EventEmitter, Output } from '@angular/core';
import { FormsModule } from '@angular/forms';

export interface ItemFilterValues {
  category: string;
  dateFrom: string;
  dateTo: string;
}

@Component({
  selector: 'app-item-filters',
  standalone: true,
  imports: [FormsModule],
  templateUrl: './item-filters.html',
  styleUrl: './item-filters.scss',
})
export class ItemFilters {
  @Output() filtersChange = new EventEmitter<ItemFilterValues>();

  filters: ItemFilterValues = { category: '', dateFrom: '', dateTo: '' };

  onChange(): void {
    this.filtersChange.emit({ ...this.filters });
  }

  reset(): void {
    this.filters = { category: '', dateFrom: '', dateTo: '' };
    this.onChange();
  }
}