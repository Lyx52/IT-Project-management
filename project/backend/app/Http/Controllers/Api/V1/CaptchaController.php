<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Services\MathCaptcha;
use Illuminate\Http\JsonResponse;

class CaptchaController extends Controller
{
    /**
     * New CAPTCHA challenge
     *
     * Returns a math question for the registration form. Send `captcha_id` and
     * the user's `captcha_answer` with POST /register. A challenge allows one
     * attempt and expires after `expires_in` seconds; fetch a new one after
     * any failed registration.
     */
    public function __invoke(MathCaptcha $captcha): JsonResponse
    {
        return response()
            ->json($captcha->create())
            ->header('Cache-Control', 'no-store');
    }
}
