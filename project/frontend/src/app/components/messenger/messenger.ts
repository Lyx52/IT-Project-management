import { Component } from '@angular/core';
import en from '../../../assets/en.json';
import lv from '../../../assets/lv.json';

@Component({
  selector: 'app-messenger',
  imports: [],
  templateUrl: './messenger.html',
  styleUrl: './messenger.scss',
})
export class Messenger {
  texts = en;
}
