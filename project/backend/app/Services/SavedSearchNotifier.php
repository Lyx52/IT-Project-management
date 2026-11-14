<?php

namespace App\Services;

use App\Models\Post;
use App\Models\SavedSearch;
use App\Notifications\SavedSearchMatchNotification;
use Illuminate\Database\Eloquent\Collection;
use Illuminate\Support\Facades\DB;

class SavedSearchNotifier
{
    /**
     * Notifies the owner of every saved search the post matches, once per
     * search and post, so approving the post again after an edit doesn't
     * notify a second time. The author's own searches are skipped.
     *
     * Call it after the post has been approved.
     */
    public function notifyMatches(Post $post): void
    {
        // Same rule as the feed: only approved posts by users who aren't banned
        if (! $post->isApproved() || $post->user->isBanned()) {
            return;
        }

        SavedSearch::candidatesFor($post)
            ->with('user')
            ->chunkById(200, function (Collection $searches) use ($post) {
                foreach ($searches as $search) {
                    // Type and category were checked by the query, the text still needs the database
                    if ($search->q !== null && ! $search->matches($post)) {
                        continue;
                    }

                    $isNewMatch = DB::table('saved_search_matches')->insertOrIgnore([
                        'saved_search_id' => $search->id,
                        'post_id' => $post->id,
                        'created_at' => now(),
                    ]) > 0;

                    if ($isNewMatch) {
                        $search->user->notify(new SavedSearchMatchNotification($search, $post));
                    }
                }
            });
    }
}
