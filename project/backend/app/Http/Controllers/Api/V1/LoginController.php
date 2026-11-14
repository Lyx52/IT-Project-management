<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Http\Requests\Api\V1\LoginRequest;
use App\Http\Resources\UserResource;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Hash;
use Illuminate\Validation\ValidationException;

class LoginController extends Controller
{
    public function __invoke(LoginRequest $request): JsonResponse
    {
        $user = User::where('email', $request->email)->first();

        if (! $user || ! Hash::check($request->password, $user->password)) {
            throw ValidationException::withMessages([
                'email' => [__('auth.failed')],
            ]);
        }

        // Deliberately checked after the password, not before: only someone who
        // already knows the correct credentials learns that the account is
        // banned, so the endpoint cannot be used to discover which addresses
        // belong to banned accounts.
        if ($user->isBanned()) {
            abort(403, 'This account has been banned.');
        }

        $deviceName = $request->input('device_name', 'auth_token');
        $token = $user->createToken($deviceName)->plainTextToken;

        // The resource is nested inside an array, so JsonResource does not add
        // its `data` wrapper here. GET /user returns the resource directly and
        // therefore IS wrapped.
        return response()->json([
            'access_token' => $token,
            'token_type' => 'Bearer',
            'user' => new UserResource($user),
        ]);
    }
}
