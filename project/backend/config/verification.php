<?php

/*
| Rate limits for POST /api/v1/email/resend, which sends a new verification
| e-mail. Deliberately strict: every call costs an e-mail from the Resend
| quota. Limits are per user (and per IP), both must pass.
| Override with the env vars, e.g. in .env.production.
*/

return [

    'resend' => [
        // Minimum wait between two e-mails
        'cooldown_minutes' => (int) env('VERIFICATION_RESEND_COOLDOWN_MINUTES', 5),

        // Max e-mails per user per 24 hours
        'max_per_day' => (int) env('VERIFICATION_RESEND_MAX_PER_DAY', 5),

        // Max requests per IP per hour, across all users
        'max_per_ip_per_hour' => (int) env('VERIFICATION_RESEND_MAX_PER_IP_PER_HOUR', 10),
    ],

];
