<?php

namespace App\Notifications;

use App\Models\Post;
use App\Models\SavedSearch;
use Illuminate\Bus\Queueable;
use Illuminate\Notifications\Notification;

/**
 * A newly approved post matches one of the user's saved searches.
 */
class SavedSearchMatchNotification extends Notification
{
    use Queueable;

    public function __construct(
        public readonly SavedSearch $savedSearch,
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
     * @return array<string, mixed>
     */
    public function toArray(object $notifiable): array
    {
        return [
            'saved_search_id' => $this->savedSearch->id,
            'saved_search_name' => $this->savedSearch->name,
            'post_id' => $this->post->id,
            'post_title' => $this->post->title,
            'post_type' => $this->post->type->value,
            'message' => "A new post matches your saved search \"{$this->savedSearch->name}\".",
        ];
    }
}
