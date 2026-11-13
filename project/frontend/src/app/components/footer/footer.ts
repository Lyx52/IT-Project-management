import { Component, EventEmitter, Output } from '@angular/core';
import en from '../../../assets/en.json';
import lv from '../../../assets/lv.json';

@Component({
  selector: 'app-footer',
  templateUrl: './footer.html',
  styleUrl: './footer.scss',
})
export class Footer {
  texts = en;
  @Output() showTriggered = new EventEmitter<void>();

  showTerms() {
    this.showTriggered.emit();
  }
}