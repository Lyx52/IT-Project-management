import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Header } from '../../components/header/header';
import en from '../../../assets/en.json';

@Component({
  selector: 'app-terms',
  imports: [Header, RouterLink],
  templateUrl: './terms.html',
  styleUrl: './terms.scss',
})
export class Terms {
  termdata = en;
  /** Matches the privacy policy version, which is what accounts record. */
  version = '1.0';
}
