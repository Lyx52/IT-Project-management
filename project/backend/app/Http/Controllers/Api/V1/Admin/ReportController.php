<?php

namespace App\Http\Controllers\Api\V1\Admin;

use App\Http\Controllers\Controller;
use App\Http\Resources\ReportResource;
use App\Models\Report;
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

        $report->status = 'closed';
        $report->reviewed_by = $request->user()->id;
        $report->save();

        return response()->json([
            'message' => 'Report closed.',
            'data' => new ReportResource($report),
        ]);
    }
}
