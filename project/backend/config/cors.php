<?php

/*
| Cross-origin requests to the API.
|
| In production the SPA and the API share one origin behind Caddy, so the
| browser never makes a cross-origin call and this list can stay at the
| site's own address. Locally the Angular dev server (localhost:4200) talks
| to the API on another port, which is the only reason for the default.
|
| Laravel's built-in default is "*" (any website may call the API from a
| visitor's browser). Listing the real origins means a foreign page cannot
| read API responses with a visitor's browser.
|
| CORS_ALLOWED_ORIGINS: comma-separated, e.g.
|   https://findit.example.com,https://www.findit.example.com
*/

$origins = env('CORS_ALLOWED_ORIGINS', env('FRONTEND_URL', 'http://localhost:4200'));

return [

    'paths' => ['api/*'],

    'allowed_methods' => ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],

    'allowed_origins' => array_values(array_filter(array_map('trim', explode(',', (string) $origins)))),

    'allowed_origins_patterns' => [],

    'allowed_headers' => ['Accept', 'Authorization', 'Content-Type', 'X-Requested-With'],

    'exposed_headers' => ['Retry-After', 'Content-Disposition'],

    'max_age' => 3600,

    // Bearer tokens, not cookies: the browser never needs to send credentials
    'supports_credentials' => false,

];
