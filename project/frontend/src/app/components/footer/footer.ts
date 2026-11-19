import { Component } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import en from '../../../assets/en.json';

@Component({
  selector: 'app-footer',
  imports: [RouterLink, RouterLinkActive],
  templateUrl: './footer.html',
  styleUrl: './footer.scss',
})
export class Footer {
  texts = en;
}
