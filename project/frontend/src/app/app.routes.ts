import { Routes } from '@angular/router';
import { HomePageComponent } from './pages/home-page/home-page';
import { ItemsPageComponent } from './pages/items-page/items-page';
import { MapPageComponent } from './pages/map-page/map-page';
import { RegisterPageComponent } from './pages/register-page/register-page';

export const routes: Routes = [
  {
    path: '',
    redirectTo: 'home',
    pathMatch: 'full',
  },
  {
    path: 'home',
    component: HomePageComponent,
  },
  {
    path: 'items',
    component: ItemsPageComponent,
  },
  {
    path: 'map',
    component: MapPageComponent,
  },
  {
    path: 'register',
    component: RegisterPageComponent,
  },
  {
    path: '**',
    redirectTo: 'home',
  },
];
