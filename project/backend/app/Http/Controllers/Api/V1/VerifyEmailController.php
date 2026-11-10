<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\User;
use Illuminate\Auth\Events\Verified;
use Illuminate\Http\JsonResponse;

class VerifyEmailController extends Controller
{
    /**
     * Verify an e-mail address
     */
    public function __invoke(string $id, string $hash): JsonResponse
    {
        $user = User::findOrFail($id);

        // The hash ties the link to the address it was sent to
        if (! hash_equals(sha1($user->getEmailForVerification()), $hash)) {
            abort(403, 'Invalid verification link.');
        }

        if ($user->hasVerifiedEmail()) {
            abort(410, 'This verification link has already been used.');
        }

        $user->markEmailAsVerified();
        event(new Verified($user));

        return response()->json([
            'message' => 'Email address verified.',
        ]);
    }
}
