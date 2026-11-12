<?php

use App\Http\Middleware\EnsureEmailIsVerified;
use App\Http\Middleware\VerifyCaptcha;
use Illuminate\Foundation\Application;
use Illuminate\Foundation\Configuration\Exceptions;
use Illuminate\Foundation\Configuration\Middleware;
use Illuminate\Http\Request;

return Application::configure(basePath: dirname(__DIR__))
    ->withRouting(
        web: __DIR__.'/../routes/web.php',
        api: __DIR__.'/../routes/api.php',
        commands: __DIR__.'/../routes/console.php',
        health: '/up',
    )
    ->withMiddleware(function (Middleware $middleware): void {
        // In production HTTPS ends at the Caddy proxy. Trust its X-Forwarded-*
        // headers so Laravel builds https:// URLs and secure cookies work.
        // Safe because the backend has no published port.
        $middleware->trustProxies(at: '*');

        $middleware->alias([
            // Gate actions such as creating posts behind a verified e-mail.
            // A no-op while config('verification.enabled') is false.
            'verified' => EnsureEmailIsVerified::class,
            // Requires a solved math CAPTCHA, see App\Services\MathCaptcha
            'captcha' => VerifyCaptcha::class,
        ]);
    })
    ->withExceptions(function (Exceptions $exceptions): void {
        $exceptions->shouldRenderJsonWhen(
            fn (Request $request) => $request->is('api/*') || $request->expectsJson(),
        );
    })->create();
