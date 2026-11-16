import { Component, EventEmitter, inject, Input, OnInit, Output } from '@angular/core';
import { RouterLink } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import {
  AbstractControl,
  FormBuilder,
  ReactiveFormsModule,
  ValidationErrors,
  Validators,
} from '@angular/forms';

import { AuthService } from '../../services/auth';
import en from '../../../assets/en.json';
import lv from '../../../assets/lv.json';
import { PostService } from '../../services/posts.service';
import { Category, Item } from '../../models/models';

function notFutureDate(control: AbstractControl): ValidationErrors | null {
  if (!control.value) {
    return null;
  }

  const today = new Date();
  const todayString = [
    today.getFullYear(),
    String(today.getMonth() + 1).padStart(2, '0'),
    String(today.getDate()).padStart(2, '0'),
  ].join('-');

  return control.value > todayString ? { futureDate: true } : null;
}

@Component({
  selector: 'app-item-form',
  standalone: true,
  imports: [RouterLink, ReactiveFormsModule],
  templateUrl: './item-form.html',
  styleUrl: './item-form.scss',
})
export class ItemForm implements OnInit {
  private readonly auth = inject(AuthService);
  texts = en;
  private readonly fb = inject(FormBuilder);
  private readonly postService = inject(PostService);

  @Output() created = new EventEmitter<void>();

  /** When set, the form edits this post instead of creating a new one. */
  @Input() set post(value: Item | null) {
    this.editing = value;
    if (value) {
      this.form.reset({
        type: value.type,
        categoryId: value.category.id,
        title: value.title,
        description: value.description,
        eventDate: value.event_date.slice(0, 10),
        locationName: value.location_name ?? '',
      });
    }
  }
  editing: Item | null = null;

  readonly isAuthenticated = this.auth.isAuthenticated;

  categories: Category[] = [];
  isCategoriesLoading = false;
  categoriesError = '';

  readonly maxImages = 5;
  readonly maxImageSize = 5 * 1024 * 1024;

  readonly allowedImageTypes = ['image/jpeg', 'image/png', 'image/webp'];

  readonly defaultCoordinates = {
    latitude: 56.9496,
    longitude: 24.1052,
  };

  readonly form = this.fb.nonNullable.group({
    type: ['lost', Validators.required],
    categoryId: [0, [Validators.required, Validators.min(1)]],
    title: ['', [Validators.required, Validators.maxLength(100)]],
    description: ['', [Validators.required, Validators.maxLength(5000)]],
    eventDate: ['', [Validators.required, notFutureDate]],
    locationName: ['', Validators.maxLength(150)],
  });

  selectedImages: File[] = [];
  imageError = '';
  submitError = '';
  isSubmitting = false;

  ngOnInit(): void {
    this.loadCategories();
  }

  loadCategories(): void {
    this.isCategoriesLoading = true;
    this.categoriesError = '';

    this.postService.getCategories().subscribe({
      next: (response) => {
        this.categories = response.data;
        this.isCategoriesLoading = false;
      },
      error: (error) => {
        console.error('Failed to load categories:', error);
        this.categoriesError = 'Failed to load categories. Please try again.';
        this.isCategoriesLoading = false;
      },
    });
  }

  get today(): string {
    const date = new Date();

    return [
      date.getFullYear(),
      String(date.getMonth() + 1).padStart(2, '0'),
      String(date.getDate()).padStart(2, '0'),
    ].join('-');
  }

  selectType(type: 'lost' | 'found'): void {
    this.form.controls.type.setValue(type);
  }

  onFilesSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const files = Array.from(input.files ?? []);

    this.imageError = '';

    if (files.length > this.maxImages) {
      this.imageError = `You can upload up to ${this.maxImages} images.`;
      input.value = '';
      return;
    }

    const invalidType = files.find((file) => !this.allowedImageTypes.includes(file.type));

    if (invalidType) {
      this.imageError = 'Only JPG, PNG and WEBP images are allowed.';
      input.value = '';
      return;
    }

    const oversizedFile = files.find((file) => file.size > this.maxImageSize);

    if (oversizedFile) {
      this.imageError = 'Each image must be 5 MB or smaller.';
      input.value = '';
      return;
    }

    this.selectedImages = files;
  }

  removeImage(index: number): void {
    this.selectedImages = this.selectedImages.filter((_, imageIndex) => imageIndex !== index);
  }

  submit(): void {
    if (!this.isAuthenticated()) {
      return;
    }

    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    if (this.imageError) {
      return;
    }

    this.submitError = '';
    this.isSubmitting = true;

    const value = this.form.getRawValue();
    const payload = new FormData();
    const editing = this.editing;

    payload.append('type', value.type);
    payload.append('category_id', String(value.categoryId));
    payload.append('title', value.title.trim());
    payload.append('description', value.description.trim());
    payload.append('event_date', value.eventDate);

    if (editing) {
      // Coordinates and photos stay as they are; location_name may be cleared
      payload.append('location_name', value.locationName.trim());
    } else {
      payload.append('latitude', String(this.defaultCoordinates.latitude));
      payload.append('longitude', String(this.defaultCoordinates.longitude));

      if (value.locationName.trim()) {
        payload.append('location_name', value.locationName.trim());
      }

      for (const image of this.selectedImages) {
        payload.append('images[]', image);
      }
    }

    const request = editing
      ? this.postService.updatePost(editing.id, payload)
      : this.postService.createPost(payload);

    request.subscribe({
      next: () => {
        this.isSubmitting = false;

        if (editing) {
          this.created.emit();
          return;
        }

        this.form.reset({
          type: 'lost',
          categoryId: 0,
          title: '',
          description: '',
          eventDate: '',
          locationName: '',
        });

        this.selectedImages = [];
        this.created.emit();
      },
      error: (error: HttpErrorResponse) => {
        this.isSubmitting = false;

        if (error.status === 422 && error.error?.errors) {
          const errors = Object.values(error.error.errors).flat().join(' ');

          this.submitError = errors || 'Please check the form fields.';
          return;
        }

        if (error.status === 403 && editing) {
          this.submitError = error.error?.message ?? 'You cannot edit this post.';
          return;
        }

        if (error.status === 403) {
          this.submitError =
            error.error?.message ?? 'Your account must have a verified email to create a post.';
          return;
        }

        this.submitError =
          error.error?.message ?? 'Something went wrong while creating the post. Please try again.';
      },
    });
  }
}
