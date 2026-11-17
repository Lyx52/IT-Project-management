<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class ResendVerificationController extends Controller
{
    /**
     * Resend the verification e-mail
     *
     * Sends a new verification link to the signed-in user. Heavily rate
     * limited (429 with a Retry-After header), see config/verification.php.
     * Returns 409 if the address is already verified, and 404 while
     * verification is turned off (config/verification.php).
     */
    public function __invoke(Request $request): JsonResponse
    {
        if (! config('verification.enabled')) {
            return response()->json(['message' => 'E-mail verification is turned off.'], 404);
        }

        $user = $request->user();

        if ($user->hasVerifiedEmail()) {
            return response()->json(['message' => 'Email address is already verified.'], 409);
        }

        $user->sendEmailVerificationNotification();

        return response()->json(['message' => 'Verification e-mail sent.'], 202);
    }
}
