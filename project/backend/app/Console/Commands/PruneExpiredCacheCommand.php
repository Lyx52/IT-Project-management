<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;

/**
 * Deletes expired rows from the database cache table.
 *
 * Laravel's database cache store only removes an expired row when the same key
 * is read again. Math CAPTCHA challenges that were fetched but never answered
 * (App\Services\MathCaptcha) are never read again, so without this they would
 * stay in the table for good. Scheduled daily in routes/console.php.
 */
class PruneExpiredCacheCommand extends Command
{
    protected $signature = 'app:prune-expired-cache';

    protected $description = 'Delete expired entries from the database cache table';

    public function handle(): int
    {
        $store = config('cache.default');

        if (config("cache.stores.{$store}.driver") !== 'database') {
            $this->info("Cache store \"{$store}\" is not the database store, nothing to prune.");

            return self::SUCCESS;
        }

        $deleted = DB::connection(config("cache.stores.{$store}.connection"))
            ->table(config("cache.stores.{$store}.table", 'cache'))
            ->where('expiration', '<=', now()->getTimestamp())
            ->delete();

        $this->info("Deleted {$deleted} expired cache entries.");

        return self::SUCCESS;
    }
}
