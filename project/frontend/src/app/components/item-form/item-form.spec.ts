import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { ItemForm } from './item-form';

const USER = {
  id: 7,
  username: 'jane_doe',
  email: 'jane@example.com',
  email_verified_at: '2026-11-12T00:00:00Z',
  role: 'user' as const,
};

describe('ItemForm', () => {
  let fixture: ComponentFixture<ItemForm>;
  let component: ItemForm;
  let httpMock: HttpTestingController;

  const setup = () => {
    localStorage.setItem('findit.token', 'stored-token');
    localStorage.setItem('findit.user', JSON.stringify(USER));

    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])],
    });

    httpMock = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(ItemForm);
    component = fixture.componentInstance;
    fixture.detectChanges();

    // ngOnInit loads the category list.
    httpMock
      .expectOne((request) => request.url.endsWith('/category/query'))
      .flush({ data: [{ id: 1, name: 'Phones' }] });
    fixture.detectChanges();
  };

  /** Mimics typing: a programmatic setValue leaves the control pristine. */
  const type = (field: string, value: string | number) => {
    const control = component.form.get(field)!;
    control.setValue(value);
    control.markAsDirty();
  };

  const html = () => (fixture.nativeElement as HTMLElement).innerHTML;

  beforeEach(() => {
    TestBed.resetTestingModule();
    localStorage.clear();
  });

  afterEach(() => {
    httpMock.verify();
    localStorage.clear();
  });

  describe('messages', () => {
    it('stays quiet about fields the user has not touched', () => {
      setup();

      expect(component.form.invalid).toBe(true);
      expect(component.error('title')).toBeNull();
      expect(component.error('description')).toBeNull();
      expect(component.error('eventDate')).toBeNull();
    });

    it('reports every required field once submission is attempted', () => {
      setup();

      component.submit();

      expect(component.error('title')).toBe('Item name is required.');
      expect(component.error('description')).toBe('Description is required.');
      expect(component.error('eventDate')).toBe('Date is required.');
      expect(component.error('categoryId')).toBe('Please select a category.');
    });

    it('rejects a date in the future', () => {
      setup();

      type('eventDate', '2099-01-01');

      expect(component.error('eventDate')).toBe('Date cannot be in the future.');
    });

    it('accepts a date of today', () => {
      setup();

      type('eventDate', component.today);

      expect(component.error('eventDate')).toBeNull();
    });

    it('says nothing about the optional location field when it is empty', () => {
      setup();

      component.submit();

      expect(component.error('locationName')).toBeNull();
    });
  });

  describe('invalid styling', () => {
    it('marks the offending controls so they get a red border and the ! icon', () => {
      setup();

      component.submit();
      fixture.detectChanges();

      const root = fixture.nativeElement as HTMLElement;

      // Bootstrap draws the border and the inline exclamation from .is-invalid.
      expect(root.querySelector('#item-title')?.classList).toContain('is-invalid');
      expect(root.querySelector('#item-description')?.classList).toContain('is-invalid');
      expect(root.querySelector('#item-category')?.classList).toContain('is-invalid');
    });

    it('renders each message in an invalid-feedback block, not plain red text', () => {
      setup();

      component.submit();
      fixture.detectChanges();

      expect(html()).toContain('invalid-feedback');
      expect(html()).not.toContain('text-danger');
    });

    it('clears the invalid state once the field is filled in', () => {
      setup();
      component.submit();
      fixture.detectChanges();

      type('title', 'Black backpack');
      fixture.detectChanges();

      const title = (fixture.nativeElement as HTMLElement).querySelector('#item-title');

      expect(title?.classList).not.toContain('is-invalid');
      expect(component.error('title')).toBeNull();
    });

    it('ties each label to its control, so clicking the label focuses the field', () => {
      setup();
      const root = fixture.nativeElement as HTMLElement;

      for (const id of ['item-title', 'item-category', 'item-date', 'item-description']) {
        expect(root.querySelector(`label[for="${id}"]`)).not.toBeNull();
        expect(root.querySelector(`#${id}`)).not.toBeNull();
      }
    });
  });

  describe('image errors', () => {
    /**
     * Goes through the real `(change)` binding rather than calling the handler.
     * Angular marks the view dirty after an event binding runs, which is what
     * makes the DOM update; calling the method directly does not, so the
     * template would never re-render under zoneless change detection.
     */
    const chooseFiles = async (files: File[]) => {
      const input = (fixture.nativeElement as HTMLElement).querySelector(
        'input[type=file]',
      ) as HTMLInputElement;

      Object.defineProperty(input, 'files', { value: files, configurable: true });
      input.dispatchEvent(new Event('change'));
      await fixture.whenStable();
    };

    it('shows the upload box as invalid and explains why', async () => {
      setup();

      const tooBig = new File([new ArrayBuffer(6 * 1024 * 1024)], 'big.jpg', {
        type: 'image/jpeg',
      });
      await chooseFiles([tooBig]);

      const upload = (fixture.nativeElement as HTMLElement).querySelector('.image-upload');

      expect(component.imageError()).toBe('Each image must be 5 MB or smaller.');
      expect(html()).toContain('Each image must be 5 MB or smaller.');
      expect(upload?.classList).toContain('is-invalid');
    });

    it('rejects a file type the backend would not accept', () => {
      setup();

      const wrongType = new File(['x'], 'notes.pdf', { type: 'application/pdf' });
      component.onFilesSelected({ target: { files: [wrongType], value: '' } } as unknown as Event);

      expect(component.imageError()).toBe('Only JPG, PNG and WEBP images are allowed.');
      expect(component.selectedImages()).toEqual([]);
    });
  });

  describe('reacting to a failed submit', () => {
    /** Fills in everything the backend requires, then submits via the real event. */
    const submitValidForm = async () => {
      component.form.patchValue({
        type: 'lost',
        categoryId: 1,
        title: 'Black backpack',
        description: 'Left on the bus.',
        eventDate: component.today,
        locationName: 'Riga',
      });

      // submit() refuses without map coordinates, which are normally set by
      // clicking the Leaflet map - unavailable in a unit test.
      component.selectedCoordinates.set({ latitude: 56.9496, longitude: 24.1052 });

      const form = (fixture.nativeElement as HTMLElement).querySelector('form')!;
      form.dispatchEvent(new Event('submit'));
      await fixture.whenStable();

      return httpMock.expectOne((request) => request.url.endsWith('/posts'));
    };

    it('shows the rejection without the user having to touch a field', async () => {
      setup();

      const request = await submitValidForm();
      request.flush(
        {
          message: 'The images.0 failed to upload.',
          errors: { 'images.0': ['The images.0 failed to upload.'] },
        },
        { status: 422, statusText: 'Unprocessable Content' },
      );
      await fixture.whenStable();

      // The whole point: this used to stay on "Creating..." until an unrelated
      // field changed, because the state was a plain property and the app runs
      // without zone.js.
      expect(component.isSubmitting()).toBe(false);
      expect(html()).toContain('The images.0 failed to upload.');
      expect(html()).not.toContain('Creating...');
      expect(html()).toContain('Submit report');
    });

    it('reports a 403 from the unverified-account gate', async () => {
      setup();

      const request = await submitValidForm();
      request.flush(
        { message: 'Your email address is not verified.' },
        { status: 403, statusText: 'Forbidden' },
      );
      await fixture.whenStable();

      expect(html()).toContain('Your email address is not verified.');
      expect(component.isSubmitting()).toBe(false);
    });

    it('clears the form and announces success', async () => {
      setup();

      const request = await submitValidForm();
      request.flush({ data: { id: 1 } }, { status: 201, statusText: 'Created' });
      await fixture.whenStable();

      expect(component.isSubmitting()).toBe(false);
      expect(component.form.controls.title.value).toBe('');
      expect(component.selectedImages()).toEqual([]);
    });
  });
});
