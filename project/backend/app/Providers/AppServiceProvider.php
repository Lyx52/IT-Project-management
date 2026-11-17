<?php

namespace App\Providers;

use Illuminate\Cache\RateLimiting\Limit;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Support\ServiceProvider;

class AppServiceProvider extends ServiceProvider
{
    /**
     * Register any application services.
     */
    public function register(): void
    {
        //
    }

    /**
     * Bootstrap any application services.
     */
    public function boot(): void
    {
        // Password guessing. Per IP stops one machine hammering the endpoint;
        // per account stops a botnet spreading guesses for one address over
        // many IPs. The per-account limit is loose enough that the owner is
        // only slowed down, never locked out for long.
        RateLimiter::for('login', fn (Request $request) => [
            Limit::perMinute(5)->by('ip:'.$request->ip()),
            Limit::perMinutes(15, 10)
                ->by('account:'.hash('sha256', strtolower(trim((string) $request->input('email'))))),
        ]);

        // Limits come from config/verification.php
        RateLimiter::for('verification-resend', fn (Request $request) => [
            Limit::perMinutes(config('verification.resend.cooldown_minutes'), 1)
                ->by('cooldown:'.$request->user()?->id),
            Limit::perDay(config('verification.resend.max_per_day'))
                ->by('daily:'.$request->user()?->id),
            Limit::perHour(config('verification.resend.max_per_ip_per_hour'))
                ->by('ip:'.$request->ip()),
        ]);
    }
}
