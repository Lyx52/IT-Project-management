<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Http\Requests\StoreMessageRequest;
use App\Http\Resources\MessageResource;
use App\Models\Message;
use App\Models\Post;
use App\Models\User;
use App\Services\MessageAttachmentService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Support\Facades\DB;
use RuntimeException;

class MessageController extends Controller
{
    /**
     * List conversations
     *
     * Every conversation the signed-in user is in, one entry per post and
     * other person, most recent first. `last_message` is the newest message
     * in it (`body` is `null` when it only carries photos or videos) and
     * `unread_count` the messages from the other person that haven't been
     * read yet. Conversations about posts the user can no longer see are left
     * out.
     */
    public function conversations(Request $request): JsonResponse
    {
        $me = $request->user();

        $rows = Message::query()
            ->whereNotNull('post_id')
            ->where(fn ($q) => $q->where('sender_id', $me->id)->orWhere('receiver_id', $me->id))
            ->selectRaw(
                'post_id, MAX(id) AS last_id, SUM(CASE WHEN receiver_id = ? AND read_at IS NULL THEN 1 ELSE 0 END) AS unread',
                [$me->id],
            )
            ->groupByRaw('post_id, CASE WHEN sender_id = ? THEN receiver_id ELSE sender_id END', [$me->id])
            ->orderByDesc('last_id')
            ->get();

        $last = Message::query()
            ->whereIn('id', $rows->pluck('last_id'))
            ->with(['post.user', 'sender', 'receiver'])
            ->get()
            ->keyBy('id');

        $data = $rows->map(function ($row) use ($last, $me) {
            $message = $last->get($row->last_id);
            $post = $message?->post;

            // Same rule as everywhere else: unapproved posts and banned
            // authors' posts only exist for the author
            if (! $post || ! ($post->user_id === $me->id || ($post->isPublic() && ! $post->user->isBanned()))) {
                return null;
            }

            $other = $message->sender_id === $me->id ? $message->receiver : $message->sender;

            return [
                'post_id' => $post->id,
                'post_title' => $post->title,
                'other_user' => ['id' => $other->id, 'username' => $other->username],
                'last_message' => [
                    'id' => $message->id,
                    'body' => $message->body,
                    'created_at' => $message->created_at,
                    'sender_id' => $message->sender_id,
                ],
                'unread_count' => (int) $row->unread,
            ];
        })->filter()->values();

        return response()->json(['data' => $data]);
    }

    /**
     * Get a conversation
     *
     * The messages between the signed-in user and the other party about this
     * post, oldest first, 50 per page. A visitor always talks to the post's
     * author. The author must pass `user_id` to choose which visitor's
     * conversation to read. Received messages are marked as read.
     */
    public function index(Request $request, Post $post): AnonymousResourceCollection
    {
        $me = $request->user();
        $other = $this->counterpart($post, $me, $request->query('user_id'), forSending: false);

        $messages = Message::query()
            ->where('post_id', $post->id)
            ->where(fn ($q) => $q
                ->where(fn ($q) => $q->where('sender_id', $me->id)->where('receiver_id', $other->id))
                ->orWhere(fn ($q) => $q->where('sender_id', $other->id)->where('receiver_id', $me->id)))
            ->with(['sender', 'receiver', 'attachments'])
            ->orderBy('id')
            ->paginate(50);

        Message::where('post_id', $post->id)
            ->where('sender_id', $other->id)
            ->where('receiver_id', $me->id)
            ->whereNull('read_at')
            ->update(['read_at' => now()]);

        return MessageResource::collection($messages);
    }

    /**
     * Send a message
     *
     * Messages are tied to the post and the body is encrypted at rest. A
     * visitor writes to the post's author. The author can only answer a
     * visitor who has already written (pass that visitor as `user_id`).
     * Responses never include e-mail addresses.
     *
     * Send as `multipart/form-data` to attach up to 3 photos or short videos
     * (`attachments[]`): jpg/png/webp up to 5 MB, mp4/webm/mov up to 20 MB.
     * The type is checked from the file's content. They are kept on the
     * private disk and reachable only through the expiring `url` of each
     * attachment. A message needs a `body`, attachments, or both.
     */
    public function store(StoreMessageRequest $request, Post $post, MessageAttachmentService $attachments): JsonResponse
    {
        $me = $request->user();
        abort_if($me->isBanned(), 403, 'This account has been banned.');

        $other = $this->counterpart($post, $me, $request->validated('user_id'), forSending: true);

        try {
            $message = DB::transaction(function () use ($request, $me, $other, $post, $attachments) {
                $message = Message::create([
                    'sender_id' => $me->id,
                    'receiver_id' => $other->id,
                    'post_id' => $post->id,
                    'body' => $request->validated('body'),
                ]);
                $attachments->attach($message, $request->file('attachments', []));

                return $message;
            });
        } catch (RuntimeException) {
            abort(422, 'One of the files could not be processed.');
        }

        return (new MessageResource($message->load(['sender', 'receiver', 'attachments'])))
            ->response()
            ->setStatusCode(201);
    }

    /**
     * Works out who the signed-in user is talking to, or aborts.
     */
    private function counterpart(Post $post, User $me, mixed $userId, bool $forSending): User
    {
        $isAuthor = $me->id === $post->user_id;

        // Unapproved posts, and every post of a banned author, don't exist for
        // anyone but their author (same rule as the feed and GET /post/{post})
        abort_unless($isAuthor || ($post->isPublic() && ! $post->user->isBanned()), 404);

        if (! $isAuthor) {
            return $post->user;
        }

        // Whole positive numbers only: "1e3" or "1.5" pass is_numeric() but
        // make PostgreSQL fail on the bigint column with a 500
        $userId = filter_var($userId, FILTER_VALIDATE_INT, ['options' => ['min_range' => 1]]);

        abort_if($userId === false, 422, 'user_id is required when you are the author of the post.');

        // The author can only deal with people who have written to them about this post
        $hasWritten = Message::where('post_id', $post->id)
            ->where('sender_id', $userId)
            ->where('receiver_id', $me->id)
            ->exists();

        abort_unless($hasWritten, $forSending ? 403 : 404, $forSending
            ? 'You can only reply to someone who has messaged you about this post.'
            : 'No conversation with this user.');

        return User::findOrFail($userId);
    }
}
