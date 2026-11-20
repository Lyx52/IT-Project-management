import {
  Component,
  computed,
  ElementRef,
  EventEmitter,
  inject,
  Input,
  OnInit,
  Output,
  signal,
  ViewChild,
} from '@angular/core';
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
import { Category, Item, ItemImage } from '../../models/models';
import * as L from 'leaflet';

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

  readonly selectedCoordinates = signal<{
    latitude: number;
    longitude: number;
  } | null>(null);

  readonly locationError = signal('');

  private map?: L.Map;
  private selectedMarker?: L.CircleMarker;

  readonly initialMapCenter = {
    latitude: 56.9496,
    longitude: 24.1052,
  };

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

      this.existingImages.set(value.images ?? []);
      this.removedImageIds.set([]);

      if (value.latitude !== null && value.longitude !== null) {
        this.selectedCoordinates.set({ latitude: value.latitude, longitude: value.longitude });
        this.showSelectedMarker();
      }
    }
  }
  editing: Item | null = null;

  /** Editing: the photos the post has now, and the ones marked for removal. */
  readonly existingImages = signal<ItemImage[]>([]);
  readonly removedImageIds = signal<number[]>([]);

  /** Existing photos that stay after saving. */
  readonly keptImages = computed(() =>
    this.existingImages().filter((image) => !this.removedImageIds().includes(image.id)),
  );

  readonly isAuthenticated = this.auth.isAuthenticated;

  // Set from HTTP callbacks, so they are signals: components are OnPush by
  // default and the app runs without zone.js, so plain fields would not redraw
  readonly categories = signal<Category[]>([]);
  readonly isCategoriesLoading = signal(false);
  readonly categoriesError = signal('');

  readonly maxImages = 5;
  readonly maxImageSize = 5 * 1024 * 1024;

  readonly allowedImageTypes = ['image/jpeg', 'image/png', 'image/webp'];

  readonly form = this.fb.nonNullable.group({
    type: ['lost', Validators.required],
    categoryId: [0, [Validators.required, Validators.min(1)]],
    title: ['', [Validators.required, Validators.maxLength(100)]],
    description: ['', [Validators.required, Validators.maxLength(5000)]],
    eventDate: ['', [Validators.required, notFutureDate]],
    locationName: ['', Validators.maxLength(150)],
  });

  readonly selectedImages = signal<File[]>([]);
  readonly imageError = signal('');
  readonly submitError = signal('');
  readonly isSubmitting = signal(false);

  @ViewChild('locationMap')
  set locationMapElement(element: ElementRef<HTMLDivElement> | undefined) {
    if (!element) {
      this.map?.remove();
      this.map = undefined;
      this.selectedMarker = undefined;
      return;
    }

    if (!this.map) {
      this.initializeLocationMap(element.nativeElement);
    }
  }

  /**
   * The message to show under a field, or null to show nothing. Stays quiet
   * until the field has been touched or edited, so an untouched form is not a
   * wall of red. Same shape as the register and login pages.
   */
  error(name: string): string | null {
    const control = this.form.get(name);

    if (!control || !(control.touched || control.dirty)) {
      return null;
    }

    const errors: ValidationErrors = control.errors ?? {};

    switch (name) {
      case 'categoryId':
        if (errors['required'] || errors['min']) return 'Please select a category.';
        break;
      case 'title':
        if (errors['required']) return 'Item name is required.';
        if (errors['maxlength']) return 'Item name must be 100 characters or fewer.';
        break;
      case 'eventDate':
        if (errors['required']) return 'Date is required.';
        if (errors['futureDate']) return 'Date cannot be in the future.';
        break;
      case 'locationName':
        if (errors['maxlength']) return 'Location must be 150 characters or fewer.';
        break;
      case 'description':
        if (errors['required']) return 'Description is required.';
        if (errors['maxlength']) return 'Description must be 5000 characters or fewer.';
        break;
    }

    return null;
  }

  ngOnInit(): void {
    this.loadCategories();
  }

  ngOnDestroy(): void {
    this.map?.remove();
  }

  private initializeLocationMap(element: HTMLDivElement): void {
    this.map = L.map(element).setView(
      [this.initialMapCenter.latitude, this.initialMapCenter.longitude],
      13,
    );

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      maxZoom: 19,
    }).addTo(this.map);

    // Editing: start on the post's saved location
    this.showSelectedMarker();

    this.map.on('click', (event: L.LeafletMouseEvent) => {
      const { lat, lng } = event.latlng;

      this.selectedCoordinates.set({
        latitude: lat,
        longitude: lng,
      });

      this.locationError.set('');

      if (this.selectedMarker) {
        this.selectedMarker.setLatLng(event.latlng);
      } else {
        this.selectedMarker = L.circleMarker(event.latlng, {
          radius: 9,
          color: '#ffffff',
          weight: 2,
          fillColor: '#39976b',
          fillOpacity: 1,
        }).addTo(this.map!);
      }
    });
  }

  /** Puts the marker on the selected location and centres the map there. */
  private showSelectedMarker(): void {
    const coordinates = this.selectedCoordinates();

    if (!this.map || !coordinates) {
      return;
    }

    const latLng = L.latLng(coordinates.latitude, coordinates.longitude);

    if (this.selectedMarker) {
      this.selectedMarker.setLatLng(latLng);
    } else {
      this.selectedMarker = L.circleMarker(latLng, {
        radius: 9,
        color: '#ffffff',
        weight: 2,
        fillColor: '#39976b',
        fillOpacity: 1,
      }).addTo(this.map);
    }

    this.map.setView(latLng, 15);
  }

  loadCategories(): void {
    this.isCategoriesLoading.set(true);
    this.categoriesError.set('');

    this.postService.getCategories().subscribe({
      next: (response) => {
        this.categories.set(response.data);
        this.isCategoriesLoading.set(false);
      },
      error: (error) => {
        console.error('Failed to load categories:', error);
        this.categoriesError.set('Failed to load categories. Please try again.');
        this.isCategoriesLoading.set(false);
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

    this.imageError.set('');

    const room = this.maxImages - this.keptImages().length;

    if (files.length > room) {
      this.imageError.set(
        this.editing
          ? `This post can have up to ${this.maxImages} images, so you can add ${room} more.`
          : `You can upload up to ${this.maxImages} images.`,
      );
      input.value = '';
      return;
    }

    const invalidType = files.find((file) => !this.allowedImageTypes.includes(file.type));

    if (invalidType) {
      this.imageError.set('Only JPG, PNG and WEBP images are allowed.');
      input.value = '';
      return;
    }

    const oversizedFile = files.find((file) => file.size > this.maxImageSize);

    if (oversizedFile) {
      this.imageError.set('Each image must be 5 MB or smaller.');
      input.value = '';
      return;
    }

    this.selectedImages.set(files);
  }

  /** Marks an existing photo for removal; it is deleted when the post is saved. */
  removeExistingImage(id: number): void {
    this.removedImageIds.update((ids) => [...ids, id]);
    this.imageError.set('');
  }

  removeImage(index: number): void {
    this.selectedImages.update((images) => images.filter((_, imageIndex) => imageIndex !== index));
  }

  submit(): void {
    if (!this.isAuthenticated()) {
      return;
    }

    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    if (this.imageError()) {
      return;
    }

    if (!this.selectedCoordinates()) {
      this.locationError.set('Please select a location on the map.');
      return;
    }

    this.submitError.set('');
    this.isSubmitting.set(true);

    const value = this.form.getRawValue();
    const payload = new FormData();
    const editing = this.editing;

    payload.append('type', value.type);
    payload.append('category_id', String(value.categoryId));
    payload.append('title', value.title.trim());
    payload.append('description', value.description.trim());
    payload.append('event_date', value.eventDate);
    const coordinates = this.selectedCoordinates()!;
    payload.append('latitude', String(coordinates.latitude));
    payload.append('longitude', String(coordinates.longitude));

    if (editing) {
      // location_name may be cleared
      payload.append('location_name', value.locationName.trim());

      for (const id of this.removedImageIds()) {
        payload.append('remove_images[]', String(id));
      }

      for (const image of this.selectedImages()) {
        payload.append('images[]', image);
      }
    } else {
      if (value.locationName.trim()) {
        payload.append('location_name', value.locationName.trim());
      }

      for (const image of this.selectedImages()) {
        payload.append('images[]', image);
      }
    }

    const request = editing
      ? this.postService.updatePost(editing.id, payload)
      : this.postService.createPost(payload);

    request.subscribe({
      next: () => {
        this.isSubmitting.set(false);

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

        this.selectedCoordinates.set(null);
        this.locationError.set('');

        this.selectedMarker?.remove();
        this.selectedMarker = undefined;

        this.selectedImages.set([]);
        this.created.emit();
      },
      error: (error: HttpErrorResponse) => {
        this.isSubmitting.set(false);

        if (error.status === 422 && error.error?.errors) {
          const errors = Object.values(error.error.errors).flat().join(' ');

          this.submitError.set(errors || 'Please check the form fields.');
          return;
        }

        if (error.status === 403 && editing) {
          this.submitError.set(error.error?.message ?? 'You cannot edit this post.');
          return;
        }

        if (error.status === 403) {
          this.submitError.set(
            error.error?.message ?? 'Your account must have a verified email to create a post.',
          );
          return;
        }

        this.submitError.set(
          error.error?.message ?? 'Something went wrong while creating the post. Please try again.',
        );
      },
    });
  }
}
