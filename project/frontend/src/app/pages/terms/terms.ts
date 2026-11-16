import { Component, Output, EventEmitter } from '@angular/core';
import en from '../../../assets/en.json';
import lv from '../../../assets/lv.json';
import { Header } from '../../components/header/header';
import { Router } from '@angular/router';

@Component({
  selector: 'app-terms',
  imports: [Header],
  templateUrl: './terms.html',
  styleUrl: './terms.scss',
})
export class Terms {
  termdata = en;
  version = '1.0.0';

  constructor(private router: Router) {}

  acceptTerms(): void {
    this.router.navigate(['/']);
  }
}
