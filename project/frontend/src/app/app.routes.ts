import { Routes } from '@angular/router';
import { HomePageComponent } from './pages/home-page/home-page';
import { ItemsPageComponent } from './pages/items-page/items-page';
import { MapPageComponent } from './pages/map-page/map-page';

export const routes: Routes = [
  {
    path: '',
    redirectTo: 'home',
    pathMatch: 'full'
  },
  {
    path: 'home',
    component: HomePageComponent
  },
  {
    path: 'lost',
    component: ItemsPageComponent,
    data: { type: 'LOST' }
  },
  {
    path: 'found',
    component: ItemsPageComponent,
    data: { type: 'FOUND' }
  },
  {
    path: 'map',
    component: MapPageComponent
  },
  {
    path: '**',
    redirectTo: 'home'
  }
];
