import { Component, signal } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { CookieNotice } from './components/cookie/cookie-notice';

@Component({
  imports: [RouterOutlet, CookieNotice],
  selector: 'app-root',
  styleUrl: './app.scss',
  templateUrl: './app.html',
})
export class App {
  protected readonly title = signal('frontend');
}
