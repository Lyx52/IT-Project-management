<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Http\Requests\Api\V1\ReportUserRequest;
use App\Models\Message;
use App\Models\Post;
use App\Models\User;
use App\Models\UserReport;
use Illuminate\Database\UniqueConstraintViolationException;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Gate;

class ReportUserController extends Controller
{
    public function __invoke(ReportUserRequest $request, User $user): JsonResponse
    {
        $reporter = $request->user();

        abort_if($reporter->isBanned(), 403, 'This account has been banned.');

        if ($reporter->id === $user->id) {
            return response()->json([
                'message' => 'You cannot report your own account.',
            ], 422);
        }

        $post = Post::findOrFail($request->validated('post_id'));
        $canReportFromPost = $post->user_id === $user->id
            && Gate::forUser($reporter)->allows('view', $post);

        $canReportFromConversation = Message::query()
            ->where('post_id', $post->id)
            ->where(function ($query) use ($reporter, $user): void {
                $query->where(function ($pair) use ($reporter, $user): void {
                    $pair->where('sender_id', $reporter->id)
                        ->where('receiver_id', $user->id);
                })->orWhere(function ($pair) use ($reporter, $user): void {
                    $pair->where('sender_id', $user->id)
                        ->where('receiver_id', $reporter->id);
                });
            })
            ->exists();

        abort_unless($canReportFromPost || $canReportFromConversation, 404);

        try {
            $report = UserReport::create([
                'reported_user_id' => $user->id,
                'reporter_id' => $reporter->id,
                'post_id' => $post->id,
                'reason' => $request->validated('reason'),
                'status' => 'open',
            ]);
        } catch (UniqueConstraintViolationException) {
            return response()->json([
                'message' => 'You have already reported this user.',
            ], 409);
        }

        return response()->json([
            'message' => 'User report submitted.',
            'data' => [
                'id' => $report->id,
                'reported_user_id' => $report->reported_user_id,
                'post_id' => $report->post_id,
                'reason' => $report->reason,
                'status' => $report->status,
                'created_at' => $report->created_at,
            ],
        ], 201);
    }
}
