import { AfterViewInit, ChangeDetectorRef, Component, OnDestroy, signal } from '@angular/core';
import { Router } from '@angular/router';
import { Subscription, timeout, finalize } from 'rxjs';
import * as L from 'leaflet';

import { Item } from '../../models/models';

import { Header } from '../../components/header/header';
import { ItemCard } from '../../components/item-card/item-card';
import { Footer } from '../../components/footer/footer';

import en from '../../../assets/en.json';
import { PostService } from '../../services/posts.service';
import { MOCK_ITEMS } from '../../models/mock-items';

import { HttpClient, HttpParams } from '@angular/common/http';
import { FormsModule, NgModel } from '@angular/forms';
import { inject } from '@angular/core';
import { MessengerLauncher } from '../../components/messenger-launcher/messenger-launcher';

@Component({
  selector: 'app-map-page',
  standalone: true,
  imports: [Header, ItemCard, Footer, FormsModule, MessengerLauncher],
  templateUrl: './map-page.html',
  styleUrl: './map-page.scss',
})
export class MapPageComponent implements AfterViewInit, OnDestroy {
  items: Item[] = [];
  texts = en;

  private map?: L.Map;
  private markers?: L.LayerGroup;
  private postsSubscription?: Subscription;

  searchQuery = '';
  isSearching = false;

  nearbyItems: Item[] = [];

  private readonly nearbyRadius = 10; // kilometres

  searchError = '';

  private searchErrorTimeout?: ReturnType<typeof setTimeout>;
  private readonly cdr = inject(ChangeDetectorRef);

  private readonly http = inject(HttpClient);

  constructor(
    private router: Router,
    private postService: PostService,
  ) {}

  ngAfterViewInit(): void {
    this.initializeMap();
    this.loadPosts();
  }

  private initializeMap(): void {
    this.map = L.map('map').setView([56.9496, 24.1052], 13);

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      maxZoom: 19,
    }).addTo(this.map);

    this.markers = L.layerGroup().addTo(this.map);

    // Update nearby items when map position changes
    this.map.on('moveend', () => {
      this.updateNearbyItems();
    });
  }

  private loadPosts(): void {
    this.postsSubscription = this.postService.getPosts().subscribe({
      next: (response) => {
        this.items = response.data as Item[];
        this.addMarkers();
        this.updateNearbyItems();
      },
      error: (error) => {
        console.error('Failed to load map items:', error);
      },
    });
  }

  private addMarkers(): void {
    if (!this.map || !this.markers) {
      return;
    }

    this.markers.clearLayers();

    this.items.forEach((item) => {
      if (item.latitude === null || item.longitude === null) {
        return;
      }

      const marker = L.circleMarker([item.latitude, item.longitude], {
        radius: 9,
        color: '#ffffff',
        weight: 2,
        fillColor: item.type === 'lost' ? '#e87942' : '#39976b',
        fillOpacity: 1,
      });

      marker.bindPopup(this.createPopupContent(item), {
        maxWidth: 280,
        minWidth: 240,
      });

      // Open popup on hover
      marker.on('mouseover', () => marker.openPopup());

      // Open popup on click
      marker.on('click', () => marker.openPopup());

      marker.addTo(this.markers!);
    });
  }

  private createPopupContent(item: Item): HTMLElement {
    const container = document.createElement('div');
    container.style.width = '240px';
    container.style.fontFamily = 'Arial, sans-serif';

    // Image or placeholder
    const imageContainer = document.createElement('div');
    imageContainer.style.width = '100%';
    imageContainer.style.height = '130px';
    imageContainer.style.marginBottom = '10px';
    imageContainer.style.borderRadius = '8px';
    imageContainer.style.overflow = 'hidden';
    imageContainer.style.background = '#f1f1f1';
    imageContainer.style.display = 'flex';
    imageContainer.style.alignItems = 'center';
    imageContainer.style.justifyContent = 'center';

    const imageUrl = item.images?.[0]?.url;

    if (imageUrl) {
      const image = document.createElement('img');
      image.src = imageUrl;
      image.alt = item.title;
      image.style.width = '100%';
      image.style.height = '100%';
      image.style.objectFit = 'cover';

      image.onerror = () => {
        imageContainer.innerHTML = '';
        imageContainer.textContent = '📦';
        imageContainer.style.fontSize = '40px';
      };

      imageContainer.appendChild(image);
    } else {
      imageContainer.textContent = '📦';
      imageContainer.style.fontSize = '40px';
    }

    // Lost / Found badge
    const badge = document.createElement('span');
    badge.textContent = item.type === 'lost' ? 'Lost' : 'Found';
    badge.style.display = 'inline-block';
    badge.style.padding = '4px 9px';
    badge.style.borderRadius = '5px';
    badge.style.fontSize = '11px';
    badge.style.fontWeight = 'bold';
    badge.style.color = 'white';
    badge.style.background = item.type === 'lost' ? '#e87942' : '#39976b';

    // Title
    const title = document.createElement('h6');
    title.textContent = item.title;
    title.style.fontWeight = 'bold';
    title.style.margin = '8px 0';

    // Description
    const description = document.createElement('p');
    description.textContent = item.description;
    description.style.fontSize = '12px';
    description.style.color = '#666';
    description.style.margin = '0 0 10px';
    description.style.lineHeight = '1.4';

    // Additional information
    const details = document.createElement('div');
    details.style.fontSize = '12px';
    details.style.color = '#555';
    details.style.marginBottom = '12px';

    const category = document.createElement('p');
    category.textContent = `Category: ${item.category.name}`;
    category.style.margin = '4px 0';

    const location = document.createElement('p');
    location.textContent = `Location: ${item.location_name || 'Unknown'}`;
    location.style.margin = '4px 0';

    const date = document.createElement('p');
    date.textContent = `Date: ${item.event_date}`;
    date.style.margin = '4px 0';

    details.append(category, location, date);

    // View details button
    const button = document.createElement('button');
    button.textContent = 'View details';
    button.className = 'btn btn-primary btn-sm w-100';

    button.addEventListener('click', () => {
      this.router.navigate(['/post', item.id]);
    });

    container.append(imageContainer, badge, title, description, details, button);

    return container;
  }

  ngOnDestroy(): void {
    this.postsSubscription?.unsubscribe();
    this.map?.remove();
    if (this.searchErrorTimeout) {
      clearTimeout(this.searchErrorTimeout);
    }
  }

  searchLocation(): void {
    const query = this.searchQuery.trim();

    if (!query || !this.map) return;

    console.log('Searching location:', query);

    this.searchError = '';

    if (this.searchErrorTimeout) {
      clearTimeout(this.searchErrorTimeout);
    }

    this.isSearching = true;

    const params = new HttpParams()
      .set('q', `${query}, Latvia`)
      .set('format', 'jsonv2')
      .set('limit', '1')
      .set('countrycodes', 'lv');

    this.http
      .get<{ lat: string; lon: string; type: string }[]>(
        'https://nominatim.openstreetmap.org/search',
        { params },
      )
      .pipe(
        timeout(10000),
        finalize(() => {
          this.isSearching = false;
        }),
      )
      .subscribe({
        next: (results) => {
          if (results.length === 0) {
            this.showSearchError('Location not found. Please enter a valid city or street.');
            return;
          }

          const location = results[0];

          const zoom = location.type === 'city' || location.type === 'administrative' ? 12 : 16;

          this.map?.setView([Number(location.lat), Number(location.lon)], zoom);

          this.updateNearbyItems();
        },

        error: (error) => {
          if (error.name === 'TimeoutError') {
            this.showSearchError('Location search timed out. Please try again.');
          } else {
            this.showSearchError('Unable to search for this location. Please try again.');
          }
        },
      });
  }

  private updateNearbyItems(): void {
    if (!this.map) return;

    const center = this.map.getCenter();

    this.nearbyItems = this.items.filter((item) => {
      if (item.latitude === null || item.longitude === null) {
        return false;
      }

      const distance = this.calculateDistance(
        center.lat,
        center.lng,
        item.latitude,
        item.longitude,
      );

      return distance <= this.nearbyRadius;
    });
  }

  private calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const earthRadius = 6371;

    const toRadians = (degrees: number) => degrees * (Math.PI / 180);

    const latitudeDifference = toRadians(lat2 - lat1);
    const longitudeDifference = toRadians(lon2 - lon1);

    const a =
      Math.sin(latitudeDifference / 2) ** 2 +
      Math.cos(toRadians(lat1)) *
        Math.cos(toRadians(lat2)) *
        Math.sin(longitudeDifference / 2) ** 2;

    return earthRadius * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  }

  private showSearchError(message: string): void {
    this.searchError = message;
    this.cdr.detectChanges();

    if (this.searchErrorTimeout) {
      clearTimeout(this.searchErrorTimeout);
    }

    this.searchErrorTimeout = setTimeout(() => {
      this.searchError = '';
      this.cdr.detectChanges();
    }, 3000);
  }
}
