import { Component, EventEmitter, inject, Output } from '@angular/core';
import { RouterLink } from '@angular/router';
import { AuthService } from '../../services/auth';
import { HttpErrorResponse } from '@angular/common/http';
import { AbstractControl, FormBuilder, ReactiveFormsModule, ValidationErrors, Validators } from '@angular/forms';
import { POST_CATEGORIES } from '../../models/post.category';
import { PostService } from '../../services/posts.service';

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
export class ItemForm {
  private readonly auth = inject(AuthService);
  private readonly fb = inject(FormBuilder);
  private readonly postService = inject(PostService);

  @Output() created = new EventEmitter<void>();

  readonly isAuthenticated = this.auth.isAuthenticated;
  readonly categories = POST_CATEGORIES;

  readonly maxImages = 5;
  readonly maxImageSize = 5 * 1024 * 1024;

  readonly allowedImageTypes = [
    'image/jpeg',
    'image/png',
    'image/webp',
  ];

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

    const invalidType = files.find(
      (file) => !this.allowedImageTypes.includes(file.type),
    );

    if (invalidType) {
      this.imageError = 'Only JPG, PNG and WEBP images are allowed.';
      input.value = '';
      return;
    }

    const oversizedFile = files.find(
      (file) => file.size > this.maxImageSize,
    );

    if (oversizedFile) {
      this.imageError = 'Each image must be 5 MB or smaller.';
      input.value = '';
      return;
    }

    this.selectedImages = files;
  }

  removeImage(index: number): void {
    this.selectedImages = this.selectedImages.filter(
      (_, imageIndex) => imageIndex !== index,
    );
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

    payload.append('type', value.type);
    payload.append('category_id', String(value.categoryId));
    payload.append('title', value.title.trim());
    payload.append('description', value.description.trim());
    payload.append('event_date', value.eventDate);
    payload.append('latitude', String(this.defaultCoordinates.latitude));
    payload.append('longitude', String(this.defaultCoordinates.longitude));

    if (value.locationName.trim()) {
      payload.append('location_name', value.locationName.trim());
    }

    for (const image of this.selectedImages) {
      payload.append('images[]', image);
    }

    this.postService.createPost(payload).subscribe({
      next: () => {
        this.isSubmitting = false;
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
          const errors = Object.values(error.error.errors)
            .flat()
            .join(' ');

          this.submitError = errors || 'Please check the form fields.';
          return;
        }

        if (error.status === 403) {
          this.submitError =
            error.error?.message ??
            'Your account must have a verified email to create a post.';
          return;
        }

        this.submitError =
          error.error?.message ??
          'Something went wrong while creating the post. Please try again.';
      },
    });
  }
}
