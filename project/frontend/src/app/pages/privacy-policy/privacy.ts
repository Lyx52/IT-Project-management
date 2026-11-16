import { Component } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { Header } from '../../components/header/header';
import en from '../../../assets/en.json';
import lv from '../../../assets/lv.json';

@Component({
  selector: 'app-privacy',
  standalone: true,
  imports: [RouterLink, Header],
  templateUrl: './privacy.html',
  styleUrl: './privacy.scss',
})
export class PrivacyComponent {
  privacy = en;

  constructor(private router: Router) {}

  acceptprivacy(): void {
    this.router.navigate(['/']);
  }
}
