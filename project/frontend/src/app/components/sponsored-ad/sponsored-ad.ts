import {
  Component,
  Input,
  OnChanges,
  OnDestroy,
  OnInit,
  SimpleChanges,
  inject,
  signal,
} from '@angular/core';
import { Subscription } from 'rxjs';
import { SponsoredAdvertisement } from '../../models/models';
import { AdvertisementsService } from '../../services/advertisements.service';

@Component({
  selector: 'app-sponsored-ad',
  standalone: true,
  templateUrl: './sponsored-ad.html',
  styleUrl: './sponsored-ad.scss',
})
export class SponsoredAd implements OnChanges, OnInit, OnDestroy {
  @Input() categoryId: number | null = null;

  private readonly advertisements = inject(AdvertisementsService);
  private request?: Subscription;
  private inputChanged = false;
  readonly ad = signal<SponsoredAdvertisement | null>(null);

  ngOnChanges(_changes: SimpleChanges): void {
    this.inputChanged = true;
    this.load();
  }

  ngOnInit(): void {
    if (!this.inputChanged) this.load();
  }

  private load(): void {
    this.request?.unsubscribe();
    this.ad.set(null);
    this.request = this.advertisements.getForCategory(this.categoryId).subscribe({
      next: (ad) => this.ad.set(ad),
      error: (error) => {
        console.error('Failed to load sponsored advertisement:', error);
        this.ad.set(null);
      },
    });
  }

  ngOnDestroy(): void {
    this.request?.unsubscribe();
  }
}
