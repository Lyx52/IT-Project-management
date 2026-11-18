import { Component, output } from '@angular/core';
import en from '../../../assets/en.json';
import lv from '../../../assets/lv.json';

@Component({
  selector: 'app-safety-tips',
  imports: [],
  templateUrl: './safety-tips.html',
  styleUrl: './safety-tips.scss',
  host: {
    '(document:click)': 'onDocumentClick($event)',
    '(document:keydown.escape)': 'closeMenu(); closeNav()',
  },
})
export class safetyTips {
  texts = en;
  readonly collapseRequested = output<void>();

  collapse(): void {
    this.collapseRequested.emit();
  }
}
