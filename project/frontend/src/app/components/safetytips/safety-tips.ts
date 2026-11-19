import { Component, output } from '@angular/core';
import en from '../../../assets/en.json';

@Component({
  selector: 'app-safety-tips',
  imports: [],
  templateUrl: './safety-tips.html',
  styleUrl: './safety-tips.scss',
})
export class safetyTips {
  texts = en;
  readonly collapseRequested = output<void>();

  collapse(): void {
    this.collapseRequested.emit();
  }
}
