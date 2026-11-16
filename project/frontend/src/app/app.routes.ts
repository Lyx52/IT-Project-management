import { Routes } from '@angular/router';
import { HomePageComponent } from './pages/home-page/home-page';
import { ItemsPageComponent } from './pages/items-page/items-page';
import { MapPageComponent } from './pages/map-page/map-page';
import { LoginPageComponent } from './pages/login-page/login-page';
import { RegisterPageComponent } from './pages/register-page/register-page';
import { AdminStatisticsPage } from './pages/admin-statistics-page/admin-statistics-page';
import { adminGuard } from './guards/admin-guard';
import { Terms } from './pages/terms/terms';
import { PrivacyComponent } from './pages/privacy-policy/privacy';

export const routes: Routes = [
  {
    path: '',
    redirectTo: 'home',
    pathMatch: 'full',
  },
  {
    path: 'home',
    title: 'FindIT – Lost & Found Near You',
    component: HomePageComponent,
  },
  {
    path: 'items',
    title: 'Lost & Found Items – FindIT',
    component: ItemsPageComponent,
  },
  {
    path: 'map',
    title: 'Map – FindIT',
    component: MapPageComponent,
  },
  {
    path: 'login',
    title: 'Sign In – FindIT',
    component: LoginPageComponent,
  },
  {
    path: 'terms',
    title: 'Terms of Use – FindIT',
    component: Terms,
  },
  {
    path: 'privacy',
    title: 'Privacy Policy – FindIT',
    component: PrivacyComponent,
  },
  {
    path: 'register',
    title: 'Create Account – FindIT',
    component: RegisterPageComponent,
  },
  {
    path: 'admin/statistics',
    component: AdminStatisticsPage,
    canActivate: [adminGuard],
  },
  {
    path: '**',
    redirectTo: 'home',
  },
];
