<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Contracts\Auth\MustVerifyEmail;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/**
 * API version of Laravel's `verified` middleware: always answers 403 instead
 * of redirecting to a verification notice page, which this API doesn't have.
 *
 * Lets everyone through while verification is turned off
 * (config/verification.php `enabled`).
 */
class EnsureEmailIsVerified
{
    public function handle(Request $request, Closure $next): Response
    {
        $user = $request->user();

        if (! $user) {
            abort(403, 'Your email address is not verified.');
        }

        if (! config('verification.enabled')) {
            return $next($request);
        }

        if ($user instanceof MustVerifyEmail && ! $user->hasVerifiedEmail()) {
            abort(403, 'Your email address is not verified.');
        }

        return $next($request);
    }
}
