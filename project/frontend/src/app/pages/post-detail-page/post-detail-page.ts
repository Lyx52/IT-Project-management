import { Component, inject, OnInit } from '@angular/core';
import { DatePipe } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';

import { Header } from '../../components/header/header';
import { Post } from '../../models/models';
import { AuthService } from '../../services/auth';
import { PostService } from '../../services/posts.service';

@Component({
  selector: 'app-post-detail-page',
  standalone: true,
  imports: [Header, DatePipe, FormsModule, RouterLink],
  templateUrl: './post-detail-page.html',
  styleUrl: './post-detail-page.scss',
})
export class PostDetailPageComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly postService = inject(PostService);
  private readonly auth = inject(AuthService);

  readonly maxMessageLength = 2000;

  post: Post | null = null;
  isLoading = true;
  notFound = false;
  errorMessage = '';
  selectedImageIndex = 0;

  isContactOpen = false;
  messageBody = '';
  isSending = false;
  messageSent = false;
  messageError = '';

  ngOnInit(): void {
    this.route.paramMap.subscribe((params) => {
      this.loadPost(Number(params.get('id')));
    });
  }

  get selectedImageUrl(): string | null {
    return this.post?.images[this.selectedImageIndex]?.url ?? null;
  }

  /** The author can't message themselves. */
  get isOwnPost(): boolean {
    return this.post !== null && this.auth.user()?.id === this.post.user.id;
  }

  /** The API only accepts messages on approved and resolved posts. */
  get canContact(): boolean {
    return this.post?.status === 'approved' || this.post?.status === 'resolved';
  }

  get needsVerification(): boolean {
    return this.auth.isAuthenticated() && this.auth.mustVerifyEmail() && !this.auth.isVerified();
  }

  selectImage(index: number): void {
    this.selectedImageIndex = index;
  }

  contact(): void {
    if (!this.auth.isAuthenticated()) {
      this.router.navigate(['/login'], { queryParams: { returnUrl: this.router.url } });
      return;
    }

    this.isContactOpen = !this.isContactOpen;
    this.messageSent = false;
    this.messageError = '';
  }

  sendMessage(): void {
    const body = this.messageBody.trim();

    if (!this.post || !body || this.isSending) {
      return;
    }

    this.isSending = true;
    this.messageError = '';

    this.postService.sendMessage(this.post.id, body).subscribe({
      next: () => {
        this.isSending = false;
        this.messageSent = true;
        this.messageBody = '';
        this.isContactOpen = false;
      },
      error: (error: HttpErrorResponse) => {
        this.isSending = false;
        this.messageError = this.messageErrorFor(error);
      },
    });
  }

  private messageErrorFor(error: HttpErrorResponse): string {
    switch (error.status) {
      case 401:
        return 'Please sign in to send a message.';
      case 403:
        return 'You need a verified e-mail address to send messages.';
      case 404:
        return 'This post is no longer available.';
      case 422:
        return error.error?.errors?.body?.[0] ?? 'Please check your message and try again.';
      case 429:
        return 'You are sending messages too fast. Please wait a moment.';
      default:
        return 'Could not send the message. Please try again.';
    }
  }

  private loadPost(id: number): void {
    this.isLoading = true;
    this.notFound = false;
    this.errorMessage = '';
    this.post = null;
    this.selectedImageIndex = 0;
    this.isContactOpen = false;
    this.messageSent = false;

    if (!Number.isInteger(id) || id < 1) {
      this.notFound = true;
      this.isLoading = false;
      return;
    }

    this.postService.getPostById(id).subscribe({
      next: (response) => {
        this.post = response.data;
        this.isLoading = false;
      },
      error: (error: HttpErrorResponse) => {
        // The API answers 404 for missing, pending and rejected posts
        if (error.status === 404) {
          this.notFound = true;
        } else {
          this.errorMessage = 'Could not load this post. Please try again.';
        }
        this.isLoading = false;
      },
    });
  }
}
