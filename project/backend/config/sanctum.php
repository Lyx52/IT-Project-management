<?php

use Illuminate\Cookie\Middleware\EncryptCookies;
use Illuminate\Foundation\Http\Middleware\ValidateCsrfToken;
use Laravel\Sanctum\Http\Middleware\AuthenticateSession;
use Laravel\Sanctum\Sanctum;

return [

    /*
    | Domains whose browser requests get cookie-based (stateful) auth. The SPA
    | uses bearer tokens, so this only matters for Sanctum's own routes.
    */
    'stateful' => explode(',', env('SANCTUM_STATEFUL_DOMAINS', sprintf(
        '%s%s',
        'localhost,localhost:3000,127.0.0.1,127.0.0.1:8000,::1',
        Sanctum::currentApplicationUrlWithPort(),
    ))),

    'guard' => ['web'],

    /*
    | Minutes until an API token stops working, counted from when it was
    | issued. Without a limit a token copied from a browser's localStorage
    | (XSS, shared computer, stolen laptop) would work forever. The user just
    | signs in again once it runs out. Expired rows are deleted daily by the
    | scheduler (routes/console.php).
    |
    | Default: 7 days. Override with SANCTUM_EXPIRATION (minutes).
    */
    'expiration' => (int) env('SANCTUM_EXPIRATION', 60 * 24 * 7),

    'token_prefix' => env('SANCTUM_TOKEN_PREFIX', ''),

    'middleware' => [
        'authenticate_session' => AuthenticateSession::class,
        'encrypt_cookies' => EncryptCookies::class,
        'validate_csrf_token' => ValidateCsrfToken::class,
    ],

];
