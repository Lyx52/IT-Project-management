<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Http\Resources\UserResource;
use Illuminate\Http\Request;

class CurrentUserController extends Controller
{
    /**
     * The signed-in user.
     *
     * Lets a client that restored a token from storage find out who it belongs
     * to, and confirm it is still valid: a token revoked on another device
     * answers 401 here instead of silently appearing to work.
     */
    public function __invoke(Request $request): UserResource
    {
        return new UserResource($request->user());
    }
}
