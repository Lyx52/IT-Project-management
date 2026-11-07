<?php

use App\Models\User;
use Illuminate\Foundation\Inspiring;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\Schedule;

Artisan::command('inspire', function () {
    $this->comment(Inspiring::quote());
})->purpose('Display an inspiring quote');

// Permanently deletes accounts soft-deleted more than retention.account_purge_days
// ago (config/retention.php). Runs in the scheduler container at 00:00 UTC, before
// the 02:00 database backup, so that backup no longer contains them.
Schedule::command('model:prune', ['--model' => [User::class]])->dailyAt('00:00');
