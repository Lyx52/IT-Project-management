import { Component, Output, EventEmitter } from '@angular/core';
import en from '../../../assets/en.json';
import lv from '../../../assets/lv.json';

@Component({
  selector: 'app-terms',
  templateUrl: './terms.html',
  styleUrl: './terms.scss',
})
export class Terms {
  termdata = en;
  version = '1.0.0';
  @Output() hideTriggered = new EventEmitter<void>();

  hideTerms() {
    this.hideTriggered.emit();
  }
}