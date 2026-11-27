<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\User;
use Illuminate\Auth\Events\PasswordReset;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Password;
use Illuminate\Validation\Rules\Password as PasswordRule;
use Illuminate\Validation\ValidationException;

class ResetPasswordController extends Controller
{
    public function __invoke(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'token' => ['required', 'string'],
            'email' => ['required', 'string', 'email', 'max:255'],
            'password' => ['required', 'confirmed', PasswordRule::min(8)->max(72)],
        ]);

        $validated['email'] = strtolower(trim($validated['email']));

        $status = Password::reset($validated, function (User $user, string $password): void {
            $user->forceFill([
                'password' => $password,
            ])->save();

            // A password reset ends every API session created with the old credentials.
            $user->tokens()->delete();

            event(new PasswordReset($user));
        });

        if ($status !== Password::PASSWORD_RESET) {
            throw ValidationException::withMessages([
                'token' => [__($status)],
            ]);
        }

        return response()->json([
            'message' => 'Your password has been reset. You can now sign in with your new password.',
        ]);
    }
}
