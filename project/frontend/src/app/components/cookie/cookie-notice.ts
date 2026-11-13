import { Component, EventEmitter, Output } from '@angular/core';
import en from '../../../assets/en.json';
import lv from '../../../assets/lv.json';

@Component({
  selector: 'app-cookie-notice',
  templateUrl: './cookie-notice.html',
  styleUrl: './cookie-notice.scss',
})
export class CookieNotice {
  texts = en;
  @Output() hidecookieTrig = new EventEmitter<void>();

  closeCookieNotice() {
    this.hidecookieTrig.emit();
  }
}