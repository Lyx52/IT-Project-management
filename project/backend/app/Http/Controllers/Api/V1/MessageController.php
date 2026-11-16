<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Http\Requests\StoreMessageRequest;
use App\Http\Resources\MessageResource;
use App\Models\Message;
use App\Models\Post;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;

class MessageController extends Controller
{
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
            ->with(['sender', 'receiver'])
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
     */
    public function store(StoreMessageRequest $request, Post $post): JsonResponse
    {
        $me = $request->user();
        abort_if($me->isBanned(), 403, 'This account has been banned.');

        $other = $this->counterpart($post, $me, $request->validated('user_id'), forSending: true);

        $message = Message::create([
            'sender_id' => $me->id,
            'receiver_id' => $other->id,
            'post_id' => $post->id,
            'body' => $request->validated('body'),
        ]);

        return (new MessageResource($message->load(['sender', 'receiver'])))
            ->response()
            ->setStatusCode(201);
    }

    /**
     * Works out who the signed-in user is talking to, or aborts.
     */
    private function counterpart(Post $post, User $me, mixed $userId, bool $forSending): User
    {
        $isAuthor = $me->id === $post->user_id;

        // Unapproved posts don't exist for anyone but their author
        abort_unless($post->isPublic() || $isAuthor, 404);

        if (! $isAuthor) {
            return $post->user;
        }

        abort_unless(is_numeric($userId), 422, 'user_id is required when you are the author of the post.');

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
