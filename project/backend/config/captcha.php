<?php

/*
| Math CAPTCHA on POST /api/v1/register (App\Services\MathCaptcha).
|
| GET /api/v1/captcha hands out a question such as "What is 7 + 5?". The answer
| stays in the cache, never in the response. Each challenge allows exactly one
| attempt, right or wrong, and expires after `ttl_seconds`.
*/

return [

    // How long a challenge can be answered
    'ttl_seconds' => (int) env('CAPTCHA_TTL_SECONDS', 300),

    // Operands are drawn from 1..max_operand. Subtraction never goes negative.
    'max_operand' => 20,

];
