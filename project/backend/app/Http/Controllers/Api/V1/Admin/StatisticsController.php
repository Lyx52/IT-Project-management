<?php

namespace App\Http\Controllers\Api\V1\Admin;

use App\Enums\PostStatus;
use App\Enums\PostType;
use App\Http\Controllers\Controller;
use App\Models\Post;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Validator;

class StatisticsController extends Controller
{
    /**
     * Return aggregate platform figures. No post, account, or message data is
     * included in this response.
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

        $counts = [];
        $statuses = array_map(fn (PostStatus $status) => $status->value, PostStatus::cases());

        foreach (PostType::cases() as $type) {
            $counts[$type->value] = array_fill_keys($statuses, 0);
        }

        $groupedCounts = DB::table('posts')
            ->select('type', 'status', DB::raw('COUNT(*) AS total'))
            ->groupBy('type', 'status')
            ->get();

        foreach ($groupedCounts as $row) {
            if (isset($counts[$row->type][$row->status])) {
                $counts[$row->type][$row->status] = (int) $row->total;
            }
        }

        $resolved = Post::query()
            ->where('status', PostStatus::Resolved)
            ->whereNotNull('resolved_at')
            ->whereDate('resolved_at', '>=', $period['from'])
            ->whereDate('resolved_at', '<=', $period['to'])
            ->get(['created_at', 'resolved_at']);

        $averageDays = $resolved->isEmpty()
            ? null
            : round($resolved->avg(fn (Post $post) => max(
                0,
                ($post->resolved_at->getTimestamp() - $post->created_at->getTimestamp()) / 86400,
            )), 2);

        return response()->json([
            'data' => [
                'period' => $period,
                'posts_by_type_and_status' => $counts,
                'resolved_count' => $resolved->count(),
                'average_resolution_days' => $averageDays,
            ],
        ]);
    }
}
