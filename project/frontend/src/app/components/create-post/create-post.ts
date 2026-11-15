import { Component, EventEmitter, Output } from '@angular/core';
import { ItemForm } from '../item-form/item-form';

@Component({
  selector: 'app-create-post',
  standalone: true,
  imports: [ItemForm],
  templateUrl: './create-post.html',
  styleUrl: './create-post.scss',
})
export class CreatePost {
  @Output() created = new EventEmitter<void>();

  isOpen = false;

  open(): void {
    this.isOpen = true;
  }

  close(): void {
    this.isOpen = false;
  }

  onPostCreated(): void {
    this.close();
    this.created.emit();
  }
}
