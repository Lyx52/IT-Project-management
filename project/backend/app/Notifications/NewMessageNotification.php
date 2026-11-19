<?php

namespace App\Notifications;

use App\Models\Message;
use App\Models\Post;
use Illuminate\Bus\Queueable;
use Illuminate\Notifications\Notification;

class NewMessageNotification extends Notification
{
    use Queueable;

    public function __construct(
        public readonly Message $message,
        public readonly Post $post,
    ) {}

    /**
     * @return array<int, string>
     */
    public function via(object $notifiable): array
    {
        return ['database'];
    }

    /**
     * Payload holds no personal data (no sender name, email, ID, or message body).
     *
     * @return array<string, mixed>
     */
    public function toArray(object $notifiable): array
    {
        return [
            'message_id' => $this->message->id,
            'post_id' => $this->post->id,
            'post_title' => $this->post->title,
            'message' => "You have a new message about \"{$this->post->title}\".",
        ];
    }
}
