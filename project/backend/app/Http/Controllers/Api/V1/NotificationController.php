<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Http\Resources\NotificationResource;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Http\Response;

class NotificationController extends Controller
{
    /**
     * List notifications
     *
     * The signed-in user's notifications, newest first, 20 per page.
     * `meta.unread_count` counts all unread ones, not just this page's.
     */
    public function index(Request $request): AnonymousResourceCollection
    {
        $user = $request->user();

        return NotificationResource::collection($user->notifications()->paginate(20))
            ->additional(['meta' => ['unread_count' => $user->unreadNotifications()->count()]]);
    }

    /**
     * Mark a notification as read
     *
     * Owner only, anyone else gets 404. Marking a read one again keeps its
     * original `read_at`.
     */
    public function read(Request $request, string $notification): NotificationResource
    {
        $notification = $request->user()->notifications()->whereKey($notification)->firstOrFail();
        $notification->markAsRead();

        return new NotificationResource($notification);
    }

    /**
     * Mark all notifications as read
     */
    public function readAll(Request $request): Response
    {
        $request->user()->unreadNotifications()->update(['read_at' => now()]);

        return response()->noContent();
    }
}
