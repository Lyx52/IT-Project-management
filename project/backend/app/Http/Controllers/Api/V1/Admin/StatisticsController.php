<?php

namespace App\Http\Controllers\Api\V1\Admin;

use App\Enums\PostStatus;
use App\Enums\PostType;
use App\Http\Controllers\Controller;
use App\Models\Post;
use App\Models\Report;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Validator;

class StatisticsController extends Controller
{
    /**
     * Return aggregate platform figures. No post, account, or message data is
     * included in this response, so the figures can be shared outside the
     * moderation team (AC-32).
     */
    public function __invoke(Request $request): JsonResponse
    {
        $period = Validator::make([
            'from' => $request->query('from', now()->startOfMonth()->toDateString()),
            'to' => $request->query('to', today()->toDateString()),
        ], [
            'from' => ['required', 'date_format:Y-m-d'],
            'to' => ['required', 'date_format:Y-m-d', 'after_or_equal:from'],
        ])->validate();

        $statuses = array_map(fn (PostStatus $status) => $status->value, PostStatus::cases());
        $types = array_map(fn (PostType $type) => $type->value, PostType::cases());

        // Every type/status pair starts at zero, so a status nobody has used
        // still appears in the response instead of being missing.
        $counts = [];

        foreach ($types as $type) {
            $counts[$type] = array_fill_keys($statuses, 0);
        }

        $byType = array_fill_keys($types, 0);
        $byStatus = array_fill_keys($statuses, 0);
        $totalPosts = 0;

        // Scoped to the window, because the response reports that window back
        // and a page that labels its figures with a date range must not show
        // all-time counts underneath it.
        $groupedCounts = DB::table('posts')
            ->select('type', 'status', DB::raw('COUNT(*) AS total'))
            ->whereDate('created_at', '>=', $period['from'])
            ->whereDate('created_at', '<=', $period['to'])
            ->groupBy('type', 'status')
            ->get();

        foreach ($groupedCounts as $row) {
            if (! isset($counts[$row->type][$row->status])) {
                continue;
            }

            $total = (int) $row->total;

            $counts[$row->type][$row->status] = $total;
            $byType[$row->type] += $total;
            $byStatus[$row->status] += $total;
            $totalPosts += $total;
        }

        $resolved = Post::query()
            ->where('status', PostStatus::Resolved)
            ->whereNotNull('resolved_at')
            ->whereDate('resolved_at', '>=', $period['from'])
            ->whereDate('resolved_at', '<=', $period['to'])
            ->get(['created_at', 'resolved_at']);

        // max(0, ...) per post: a row resolved before it was created would
        // otherwise drag the average below zero and show a negative figure.
        $averageDays = $resolved->isEmpty()
            ? null
            : round($resolved->avg(fn (Post $post) => max(
                0,
                ($post->resolved_at->getTimestamp() - $post->created_at->getTimestamp()) / 86400,
            )), 2);

        return response()->json([
            'data' => [
                'from' => $period['from'],
                'to' => $period['to'],

                'posts_by_type_and_status' => $counts,
                'total_posts' => $totalPosts,
                'by_type' => $byType,
                'by_status' => $byStatus,

                'resolved_count' => $resolved->count(),
                'average_days_to_resolution' => $averageDays,

                // Current totals rather than window-scoped: these answer "how
                // much is waiting for us right now".
                'open_reports' => Report::where('status', 'open')->count(),
                'banned_users' => User::whereNotNull('banned_at')->count(),
            ],
        ]);
    }
}
