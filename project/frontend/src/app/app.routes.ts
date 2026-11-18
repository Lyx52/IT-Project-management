import { Routes } from '@angular/router';
import { HomePageComponent } from './pages/home-page/home-page';
import { ItemsPageComponent } from './pages/items-page/items-page';
import { MapPageComponent } from './pages/map-page/map-page';
import { LoginPageComponent } from './pages/login-page/login-page';
import { RegisterPageComponent } from './pages/register-page/register-page';
import { AdminStatisticsPage } from './pages/admin-statistics-page/admin-statistics-page';
import { adminGuard } from './guards/admin-guard';
import { authGuard } from './guards/auth-guard';
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
    path: 'post/:id',
    title: 'Post – FindIT',
    loadComponent: () => import('./pages/post-page/post-page').then((m) => m.PostPage),
  },
  {
    path: 'my-posts',
    title: 'My Posts – FindIT',
    loadComponent: () => import('./pages/my-posts-page/my-posts-page').then((m) => m.MyPostsPage),
    canActivate: [authGuard],
  },
  {
    path: 'saved-searches',
    title: 'Saved Searches – FindIT',
    loadComponent: () =>
      import('./pages/saved-searches-page/saved-searches-page').then((m) => m.SavedSearchesPage),
    canActivate: [authGuard],
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
    path: 'messages/:postId',
    title: 'Messages – FindIT',
    loadComponent: () =>
      import('./pages/messages-page/messages-page').then(
        (m) => m.MessagesPage,
      ),
    canActivate: [authGuard],
  },
  {
    path: '**',
    redirectTo: 'home',
  },
];
