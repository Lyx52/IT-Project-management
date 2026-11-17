<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Services\CaptchaService;
use Illuminate\Http\JsonResponse;

class CaptchaController extends Controller
{
    /**
     * New CAPTCHA challenge
     *
     * Returns a challenge for the registration form; `type` says which kind,
     * set on the server with CAPTCHA_TYPE:
     *
     * - `math`: show `question` and let the user type the answer.
     * - `determinant`: show `question` and the 2×2 `matrix` ([[a, b], [c, d]]);
     *   the user types ad − bc, which can be negative.
     * - `hash`: find the whole number n in 0..`max_number` for which
     *   SHA-256(`salt` . n), with n in plain decimal, equals the hex
     *   `challenge`; the browser does this by itself.
     *
     * Send `captcha_id` and the answer as `captcha_answer` with POST /register.
     * A challenge allows one attempt and expires after `expires_in` seconds;
     * fetch a new one after any failed registration.
     */
    public function __invoke(CaptchaService $captcha): JsonResponse
    {
        return response()
            ->json($captcha->create())
            ->header('Cache-Control', 'no-store');
    }
}
