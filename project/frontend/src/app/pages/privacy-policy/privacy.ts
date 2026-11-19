import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Header } from '../../components/header/header';
import { environment } from '../../../environments/environment';
import en from '../../../assets/en.json';

@Component({
  selector: 'app-privacy',
  standalone: true,
  imports: [RouterLink, Header],
  templateUrl: './privacy.html',
  styleUrl: './privacy.scss',
})
export class PrivacyComponent {
  privacy = en;

  /**
   * The same version the registration form sends as `privacy_policy_version`
   * and the backend stores on the account, so the page cannot advertise a
   * version nobody has accepted.
   */
  readonly version = environment.privacyPolicyVersion;
}
