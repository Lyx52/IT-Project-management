<?php

namespace App\Notifications;

use App\Models\Post;
use Illuminate\Bus\Queueable;
use Illuminate\Notifications\Notification;

class PossibleMatchNotification extends Notification
{
    use Queueable;

    public function __construct(
        public readonly Post $post,
        public readonly Post $matchedPost,
        public readonly int $distanceMeters,
    ) {}

    /**
     * @return array<int, string>
     */
    public function via(object $notifiable): array
    {
        return ['database'];
    }

    /**
     * Payload holds no personal data (no usernames, emails, or user IDs).
     *
     * @return array<string, mixed>
     */
    public function toArray(object $notifiable): array
    {
        return [
            'post_id' => $this->post->id,
            'post_title' => $this->post->title,
            'matched_post_id' => $this->matchedPost->id,
            'matched_post_title' => $this->matchedPost->title,
            'matched_post_type' => $this->matchedPost->type->value,
            'distance_m' => $this->distanceMeters,
            'message' => "A possible match (\"{$this->matchedPost->title}\") was found for your post \"{$this->post->title}\".",
        ];
    }
}
