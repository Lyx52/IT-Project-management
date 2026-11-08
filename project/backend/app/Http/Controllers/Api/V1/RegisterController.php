<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Http\Requests\RegisterRequest;
use App\Http\Resources\UserResource;
use App\Models\User;
use Illuminate\Auth\Events\Registered;
use Illuminate\Http\JsonResponse;

class RegisterController extends Controller
{
    public function __invoke(RegisterRequest $request): JsonResponse
    {
        $user = User::create([
            'username' => $request->validated('username'),
            'email' => strtolower($request->validated('email')),
            'password' => $request->validated('password'),
            'terms_accepted_at' => now()->utc(),
            'privacy_policy_version' => $request->validated('privacy_policy_version'),
        ]);

        event(new Registered($user));

        return (new UserResource($user))
            ->response()
            ->setStatusCode(201);
    }
}