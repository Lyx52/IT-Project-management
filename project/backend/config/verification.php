<?php

return [

    /*
    | E-mail verification switch.
    |
    | Off by default: the project has no domain of its own to send mail from
    | yet. While off, new accounts get no verification e-mail, can sign in and
    | post straight away, and POST /email/resend answers 404.
    |
    | Accounts keep email_verified_at = null, so turning this back on asks every
    | account created in the meantime to verify before posting (the "Resend
    | e-mail" prompt in the header covers that).
    |
    | Turn on with EMAIL_VERIFICATION_ENABLED=true.
    */
    'enabled' => (bool) env('EMAIL_VERIFICATION_ENABLED', false),

    /*
    | Rate limits for POST /api/v1/email/resend, which sends a new verification
    | e-mail. Deliberately strict: every call costs an e-mail from the Resend
    | quota. Limits are per user (and per IP), both must pass.
    | Override with the env vars, e.g. in .env.production.
    */
    'resend' => [
        // Minimum wait between two e-mails
        'cooldown_minutes' => (int) env('VERIFICATION_RESEND_COOLDOWN_MINUTES', 5),

        // Max e-mails per user per 24 hours
        'max_per_day' => (int) env('VERIFICATION_RESEND_MAX_PER_DAY', 5),

        // Max requests per IP per hour, across all users
        'max_per_ip_per_hour' => (int) env('VERIFICATION_RESEND_MAX_PER_IP_PER_HOUR', 10),
    ],

];
