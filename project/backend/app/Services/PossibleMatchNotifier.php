<?php

namespace App\Services;

use App\Models\Post;
use App\Models\User;
use App\Notifications\PossibleMatchNotification;

class PossibleMatchNotifier
{
    /**
     * Notifies both the approved post's author and the authors of opposite-type
     * suggested matches, once per ordered (post, matched_post) pair.
     */
    public function notifyMatches(Post $post): void
    {
        if (! $post->isApproved() || $post->user->isBanned()) {
            return;
        }

        foreach ($post->suggestedMatches() as $match) {
            if ($match->user->isBanned()) {
                continue;
            }

            $distanceMeters = (int) ($match->distance_m ?? 0);

            $this->notifyOnce($post->user, $post, $match, $distanceMeters);
            $this->notifyOnce($match->user, $match, $post, $distanceMeters);
        }
    }

    private function notifyOnce(User $recipient, Post $userPost, Post $matchedPost, int $distanceMeters): void
    {
        $alreadyNotified = $recipient->notifications()
            ->where('type', PossibleMatchNotification::class)
            ->get(['data'])
            ->contains(fn ($notification): bool => ($notification->data['post_id'] ?? null) === $userPost->id
                && ($notification->data['matched_post_id'] ?? null) === $matchedPost->id);

        if (! $alreadyNotified) {
            $recipient->notify(new PossibleMatchNotification($userPost, $matchedPost, $distanceMeters));
        }
    }
}
