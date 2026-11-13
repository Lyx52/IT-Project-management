<?php

namespace App\Http\Controllers\Api\V1\Admin;

use App\Http\Controllers\Controller;
use App\Models\User;
use Illuminate\Http\JsonResponse;

class UserBanController extends Controller
{
    public function ban(User $user): JsonResponse
    {
        if ($user->isAdmin()) {
            return response()->json([
                'message' => 'Administrator accounts cannot be banned.',
            ], 422);
        }

        if (! $user->isBanned()) {
            $user->banned_at = now();
            $user->save();
        }

        // Revoke all active Sanctum tokens so active sessions are immediately terminated
        $user->tokens()->delete();

        return response()->json([
            'message' => 'User has been banned.',
            'data' => [
                'id' => $user->id,
                'username' => $user->username,
                'banned_at' => $user->banned_at,
            ],
        ]);
    }

    public function unban(User $user): JsonResponse
    {
        if ($user->isBanned()) {
            $user->banned_at = null;
            $user->save();
        }

        return response()->json([
            'message' => 'User has been unbanned.',
            'data' => [
                'id' => $user->id,
                'username' => $user->username,
                'banned_at' => $user->banned_at,
            ],
        ]);
    }
}
