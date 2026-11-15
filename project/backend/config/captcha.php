<?php

/*
| CAPTCHA on POST /api/v1/register (App\Services\CaptchaService).
|
| GET /api/v1/captcha hands out a challenge of the kind set by CAPTCHA_TYPE.
| The answer stays in the cache, never in the response. Each challenge allows
| exactly one attempt, right or wrong, and expires after `ttl_seconds`.
|
| Changing CAPTCHA_TYPE needs no frontend change: the register page shows
| whatever kind the server sends.
*/

return [

    // math        "What is 7 + 5?", typed in by the user
    // determinant the determinant of a 2×2 matrix, typed in by the user
    // hash        a SHA-256 proof-of-work puzzle the browser solves by itself
    'type' => env('CAPTCHA_TYPE', 'hash'),

    // How long a challenge can be answered
    'ttl_seconds' => (int) env('CAPTCHA_TTL_SECONDS', 300),

    'math' => [
        // Operands are drawn from 1..max_operand. Subtraction never goes negative.
        'max_operand' => 20,
    ],

    'determinant' => [
        // Entries are drawn from 1..max_entry. The answer ad − bc can be negative.
        'max_entry' => 9,
    ],

    'hash' => [
        // Upper end of the secret number's range: the most hashes a browser
        // ever has to try, and on average it tries half. The browser does
        // roughly 3 million a second on a current laptop and 100-300 thousand
        // on a cheap phone, so 3,000,000 means about 1 s worst case on a
        // laptop and at most 20-30 s on a slow phone. Keep the slow-phone
        // worst case under a minute.
        'max_number' => (int) env('CAPTCHA_MAX_NUMBER', 3_000_000),
    ],

];
