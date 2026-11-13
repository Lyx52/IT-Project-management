import { Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { AuthService } from '../../services/auth';
import en from '../../../assets/en.json';
import lv from '../../../assets/lv.json';

@Component({
  selector: 'app-item-form',
  imports: [RouterLink],
  templateUrl: './item-form.html',
  styleUrl: './item-form.scss',
})
export class ItemForm {
  private readonly auth = inject(AuthService);
  texts = en;

  /** Reporting an item needs an account, so visitors are sent to sign in. */
  readonly isAuthenticated = this.auth.isAuthenticated;
}
