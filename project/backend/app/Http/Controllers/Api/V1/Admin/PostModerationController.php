<?php

namespace App\Http\Controllers\Api\V1\Admin;

use App\Enums\PostStatus;
use App\Http\Controllers\Controller;
use App\Http\Resources\PostResource;
use App\Models\Post;
use App\Models\Report;
use App\Notifications\PostModeratedNotification;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class PostModerationController extends Controller
{
    public function queue(): JsonResponse
    {
        $pendingPosts = Post::where('status', PostStatus::Pending)
            ->with(['category', 'user', 'images'])
            ->oldest()
            ->oldest('id')
            ->get();

        $openReports = Report::where('status', 'open')
            ->with([
                'post' => fn ($query) => $query->with(['category', 'user', 'images']),
                'reporter:id,username',
            ])
            ->oldest()
            ->oldest('id')
            ->get();

        return response()->json([
            'data' => [
                'pending_posts' => PostResource::collection($pendingPosts),
                'open_reports' => $openReports->map(fn (Report $report) => [
                    'id' => $report->id,
                    'reason' => $report->reason,
                    'status' => $report->status,
                    'created_at' => $report->created_at,
                    'reporter' => $report->reporter ? [
                        'id' => $report->reporter->id,
                        'username' => $report->reporter->username,
                    ] : null,
                    'post' => $report->post ? new PostResource($report->post) : null,
                ])->values(),
            ],
        ]);
    }

    public function approve(Request $request, Post $post): JsonResponse
    {
        if ($post->status !== PostStatus::Pending) {
            return response()->json([
                'message' => 'Only pending posts can be approved.',
            ], 422);
        }

        $post->status = PostStatus::Approved;
        $post->reviewed_by = $request->user()->id;
        $post->reviewed_at = now();
        $post->save();

        $post->user->notify(new PostModeratedNotification($post));

        $post->load(['category', 'user', 'images']);

        return response()->json([
            'message' => 'Post approved.',
            'data' => new PostResource($post),
            'moderation' => [
                'reviewed_by' => $post->reviewed_by,
                'reviewed_at' => $post->reviewed_at,
            ],
        ]);
    }

    public function reject(Request $request, Post $post): JsonResponse
    {
        if ($post->status !== PostStatus::Pending) {
            return response()->json([
                'message' => 'Only pending posts can be rejected.',
            ], 422);
        }

        $validated = $request->validate([
            'reason' => ['nullable', 'string', 'max:500'],
        ]);

        $post->status = PostStatus::Rejected;
        $post->reviewed_by = $request->user()->id;
        $post->reviewed_at = now();
        $post->save();

        $post->user->notify(new PostModeratedNotification($post, $validated['reason'] ?? null));

        $post->load(['category', 'user', 'images']);

        return response()->json([
            'message' => 'Post rejected.',
            'data' => new PostResource($post),
            'moderation' => [
                'reviewed_by' => $post->reviewed_by,
                'reviewed_at' => $post->reviewed_at,
            ],
        ]);
    }
}
