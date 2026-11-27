<?php

namespace App\Console\Commands;

use App\Enums\PostStatus;
use App\Models\Post;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;

class PruneOldPlatformDataCommand extends Command
{
    protected $signature = 'app:prune-old-platform-data';

    protected $description = 'Prune resolved posts and read notifications past their retention periods';

    public function handle(): int
    {
        $now = now();
        $resolvedPostCutoff = $now->copy()->subMonths(6);
        $readNotificationCutoff = $now->copy()->subDays(90);
        $deletedPosts = 0;

        Post::query()
            ->where('status', PostStatus::Resolved->value)
            ->whereNotNull('resolved_at')
            ->where('resolved_at', '<=', $resolvedPostCutoff)
            ->chunkById(100, function ($posts) use (&$deletedPosts): void {
                foreach ($posts as $post) {
                    // Use model deletion so the Post deleting hook removes image files.
                    $post->delete();
                    $deletedPosts++;
                }
            });

        $deletedNotifications = DB::table('notifications')
            ->whereNotNull('read_at')
            ->where('read_at', '<=', $readNotificationCutoff)
            ->delete();

        $this->info(sprintf(
            'Pruned %d resolved posts older than 6 months and %d read notifications older than 90 days.',
            $deletedPosts,
            $deletedNotifications,
        ));

        return self::SUCCESS;
    }
}
