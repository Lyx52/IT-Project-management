<?php

namespace App\Notifications;

use Illuminate\Auth\Notifications\VerifyEmail;
use Illuminate\Notifications\Messages\MailMessage;

/**
 * Sent on the Registered event (User implements MustVerifyEmail). Same signed,
 * expiring link as Laravel's default, rendered with our own HTML template.
 */
class VerifyEmailNotification extends VerifyEmail
{
    public function toMail($notifiable): MailMessage
    {
        $url = $this->verificationUrl($notifiable);

        return (new MailMessage)
            ->subject('Verify your e-mail address')
            ->action('Verify e-mail', $url)
            ->view('emails.verify-email', [
                'url' => $url,
                'username' => $notifiable->username,
                'expiresInMinutes' => (int) config('auth.verification.expire', 60),
            ]);
    }
}
