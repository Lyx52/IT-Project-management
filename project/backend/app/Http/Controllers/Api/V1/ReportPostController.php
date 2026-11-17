<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Http\Requests\Api\V1\ReportPostRequest;
use App\Http\Resources\ReportResource;
use App\Models\Post;
use App\Models\Report;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Gate;

class ReportPostController extends Controller
{
    public function __invoke(ReportPostRequest $request, Post $post): JsonResponse
    {
        $reporter = $request->user();

        // Same visibility as GET /post/{post}: a post you can't see can't be
        // reported, and the 404 doesn't reveal that a hidden post exists
        abort_unless(Gate::forUser($reporter)->allows('view', $post), 404);
        abort_if($reporter->isBanned(), 403, 'This account has been banned.');

        $reporterId = $reporter->id;

        $alreadyReported = Report::where('post_id', $post->id)
            ->where('reporter_id', $reporterId)
            ->exists();

        if ($alreadyReported) {
            return response()->json([
                'message' => 'You have already reported this post.',
            ], 409);
        }

        $report = Report::create([
            'post_id' => $post->id,
            'reporter_id' => $reporterId,
            'reason' => $request->validated('reason'),
            'status' => 'open',
        ]);

        return (new ReportResource($report))
            ->response()
            ->setStatusCode(201);
    }
}
