<?php

namespace App\Http\Controllers\Api\V1\Admin;

use App\Enums\PostStatus;
use App\Http\Controllers\Controller;
use App\Http\Resources\ReportResource;
use App\Models\Report;
use App\Notifications\ReportReviewedNotification;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class ReportController extends Controller
{
    /**
     * Close a report
     *
     * Marks a report as handled and records who handled it, so it leaves the
     * moderation queue. Deciding what to do with the post itself is separate:
     * see takedown, and banning the author.
     */
    public function close(Request $request, Report $report): JsonResponse
    {
        if ($report->status === 'closed') {
            return response()->json([
                'message' => 'This report is already closed.',
            ], 422);
        }

        $validated = $request->validate([
            'outcome' => ['nullable', 'in:'.ReportReviewedNotification::ACTION_TAKEN.','.ReportReviewedNotification::DISMISSED],
        ]);

        $report->status = 'closed';
        $report->reviewed_by = $request->user()->id;
        $report->save();

        $this->notifyReporter($report, $validated['outcome'] ?? null);

        return response()->json([
            'message' => 'Report closed.',
            'data' => new ReportResource($report),
        ]);
    }

    /**
     * Lets the reporter know their report was dealt with.
     *
     * The caller says what it did, because banning the author also removes the
     * post from the feed without changing its status. When it says nothing, the
     * post's own status is the next best signal.
     */
    private function notifyReporter(Report $report, ?string $outcome): void
    {
        $report->loadMissing(['reporter', 'post']);

        // Null once the reporter deletes their account
        if ($report->reporter === null) {
            return;
        }

        $outcome ??= $report->post?->status === PostStatus::Rejected
            ? ReportReviewedNotification::ACTION_TAKEN
            : ReportReviewedNotification::DISMISSED;

        $report->reporter->notify(new ReportReviewedNotification($report, $outcome));
    }
}
