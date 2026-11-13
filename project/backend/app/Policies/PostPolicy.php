<?php

namespace App\Policies;

use App\Enums\PostStatus;
use App\Models\Post;
use App\Models\User;

class PostPolicy
{
    /**
     * Approved and resolved posts are public. Pending and rejected ones are
     * only visible to their author and admins.
     */
    public function view(?User $user, Post $post): bool
    {
        return $post->isPublic()
            || ($user !== null && ($user->id === $post->user_id || $user->isAdmin()));
    }

    public function create(User $user): bool
    {
        return $user->banned_at === null;
    }

    /**
     * Only the author edits, and not once the post is resolved.
     */
    public function update(User $user, Post $post): bool
    {
        return $user->banned_at === null
            && $user->id === $post->user_id
            && $post->status !== PostStatus::Resolved;
    }

    /**
     * Suggested matches are for the author (and admins), whatever the
     * post's status, so they show up while the post still awaits moderation.
     */
    public function viewMatches(User $user, Post $post): bool
    {
        return $user->id === $post->user_id || $user->isAdmin();
    }

    public function delete(User $user, Post $post): bool
    {
        return $user->id === $post->user_id || $user->isAdmin();
    }
}
