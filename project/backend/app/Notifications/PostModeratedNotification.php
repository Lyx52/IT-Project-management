<?php

namespace App\Notifications;

use App\Enums\PostStatus;
use App\Models\Post;
use Illuminate\Bus\Queueable;
use Illuminate\Notifications\Notification;

class PostModeratedNotification extends Notification
{
    use Queueable;

    public function __construct(
        public readonly Post $post,
        public readonly ?string $reason = null,
    ) {}

    /**
     * @return array<int, string>
     */
    public function via(object $notifiable): array
    {
        return ['database'];
    }

    /**
     * @return array<string, mixed>
     */
    public function toArray(object $notifiable): array
    {
        return [
            'post_id' => $this->post->id,
            'post_title' => $this->post->title,
            'status' => $this->post->status->value,
            'message' => $this->post->status === PostStatus::Approved
                ? 'Your post has been approved and is now visible in the public feed.'
                : 'Your post was rejected by a moderator.',
            'reason' => $this->reason,
        ];
    }
}
