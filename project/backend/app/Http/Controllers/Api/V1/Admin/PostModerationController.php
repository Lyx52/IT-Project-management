<?php

namespace App\Http\Controllers\Api\V1\Admin;

use App\Enums\PostStatus;
use App\Http\Controllers\Controller;
use App\Http\Resources\PostResource;
use App\Models\Post;
use App\Models\Report;
use App\Models\UserReport;
use App\Notifications\PostModeratedNotification;
use App\Services\PossibleMatchNotifier;
use App\Services\SavedSearchNotifier;
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

        $openUserReports = UserReport::where('status', 'open')
            ->with([
                'reportedUser:id,username,banned_at',
                'reporter:id,username',
                'post:id,title',
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
                'open_user_reports' => $openUserReports->map(fn (UserReport $report) => [
                    'id' => $report->id,
                    'reason' => $report->reason,
                    'status' => $report->status,
                    'created_at' => $report->created_at,
                    'reporter' => $report->reporter ? [
                        'id' => $report->reporter->id,
                        'username' => $report->reporter->username,
                    ] : null,
                    'reported_user' => $report->reportedUser ? [
                        'id' => $report->reportedUser->id,
                        'username' => $report->reportedUser->username,
                        'banned_at' => $report->reportedUser->banned_at,
                    ] : null,
                    'post' => $report->post ? [
                        'id' => $report->post->id,
                        'title' => $report->post->title,
                    ] : null,
                ])->values(),
            ],
        ]);
    }

    /**
     * Approve a post
     *
     * Publishes a pending post, notifies its author and the owners of saved
     * searches it matches.
     */
    public function approve(Request $request, Post $post, SavedSearchNotifier $savedSearches, PossibleMatchNotifier $possibleMatches): JsonResponse
    {
        if ($post->status !== PostStatus::Pending) {
            return response()->json([
                'message' => 'Only pending posts can be approved.',
            ], 422);
        }

        $post->status = PostStatus::Approved;
        $post->rejection_reason = null;
        $post->reviewed_by = $request->user()->id;
        $post->reviewed_at = now();
        // A previously refused post that is now published must not keep a
        // stale reason hanging off it.
        $post->rejection_reason = null;
        $post->save();

        $post->user->notify(new PostModeratedNotification($post));
        $savedSearches->notifyMatches($post);
        $possibleMatches->notifyMatches($post);

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
        $post->rejection_reason = $validated['reason'] ?? null;
        $post->reviewed_by = $request->user()->id;
        $post->reviewed_at = now();
        // Kept on the post, not only in the notification, so the author can
        // still see why it was refused (PB-38).
        $post->rejection_reason = $validated['reason'] ?? null;
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

    /**
     * Take a published post down
     *
     * Separate from reject, which only acts on posts that were never
     * published. A reported post is already approved, so this is what removes
     * it from the feed. It reuses the `rejected` status rather than adding a
     * new one, because posts.status is constrained by a CHECK and the public
     * feed already filters on approved.
     */
    public function takedown(Request $request, Post $post): JsonResponse
    {
        if (! in_array($post->status, [PostStatus::Approved, PostStatus::Resolved], true)) {
            return response()->json([
                'message' => 'Only published posts can be taken down.',
            ], 422);
        }

        $validated = $request->validate([
            'reason' => ['nullable', 'string', 'max:500'],
        ]);

        $post->status = PostStatus::Rejected;
        $post->reviewed_by = $request->user()->id;
        $post->reviewed_at = now();
        $post->rejection_reason = $validated['reason'] ?? null;
        $post->save();

        $post->user->notify(new PostModeratedNotification($post, $validated['reason'] ?? null));

        $post->load(['category', 'user', 'images']);

        return response()->json([
            'message' => 'Post taken down.',
            'data' => new PostResource($post),
            'moderation' => [
                'reviewed_by' => $post->reviewed_by,
                'reviewed_at' => $post->reviewed_at,
            ],
        ]);
    }
}
