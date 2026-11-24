<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Password;
use Illuminate\Validation\ValidationException;

class RequestPasswordResetController extends Controller
{
    public function __invoke(Request $request): JsonResponse
    {
        if ($request->has('email')) {
            $request->merge(['email' => strtolower(trim((string) $request->input('email')))]);
        }

        $validated = $request->validate([
            'email' => ['required', 'string', 'email', 'max:255'],
        ]);

        $status = Password::sendResetLink($validated);

        if (! in_array($status, [Password::RESET_LINK_SENT, Password::INVALID_USER, Password::RESET_THROTTLED], true)) {
            throw ValidationException::withMessages([
                'email' => [__($status)],
            ]);
        }

        // Keep the response identical for existing and unknown addresses.
        return response()->json([
            'message' => 'If an account exists for that e-mail address, password reset instructions have been sent.',
        ]);
    }
}
