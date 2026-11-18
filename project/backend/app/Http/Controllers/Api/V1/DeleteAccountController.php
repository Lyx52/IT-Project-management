<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class DeleteAccountController extends Controller
{
    public function __invoke(Request $request): JsonResponse
    {
        $user = $request->user();

        DB::transaction(function () use ($user): void {
            // End every session immediately, then suspend the account with
            // SoftDeletes. The scheduled model:prune command removes its data
            // after the configured 30-day grace period.
            $user->tokens()->delete();
            $user->delete();
        });

        return response()->json([
            'message' => 'Your account is suspended and scheduled for permanent deletion.',
            'data' => [
                'deleted_at' => $user->deleted_at,
                'scheduled_deletion_at' => $user->deleted_at
                    ->copy()
                    ->addDays(config('retention.account_purge_days')),
            ],
        ], 202);
    }
}
