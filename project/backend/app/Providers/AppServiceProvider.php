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
