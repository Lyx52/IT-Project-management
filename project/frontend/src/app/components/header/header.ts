import { Component } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import en from '../../../assets/en.json';
import lv from '../../../assets/lv.json';

@Component({
  selector: 'app-header',
  imports: [RouterLink, RouterLinkActive],
  templateUrl: './header.html',
  styleUrl: './header.scss',
})
export class Header {
  texts = en;
}
