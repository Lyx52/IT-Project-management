<?php

namespace App\Http\Controllers\Api\V1;

use App\Enums\PostStatus;
use App\Http\Controllers\Controller;
use App\Http\Requests\StorePostRequest;
use App\Http\Requests\UpdatePostRequest;
use App\Http\Resources\PostResource;
use App\Models\Post;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Http\Response;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Gate;

class PostController extends Controller
{
    /**
     * List posts
     *
     * The public feed: approved posts only, newest first, 20 per page.
     */
    public function index(): AnonymousResourceCollection
    {
        $posts = Post::approved()
            ->with(['category', 'user'])
            ->latest()
            ->latest('id')
            ->paginate(20);

        return PostResource::collection($posts);
    }

    /**
     * Create a post
     *
     * The post is saved with status `pending` and appears in the feed once a
     * moderator approves it.
     */
    public function store(StorePostRequest $request): JsonResponse
    {
        Gate::authorize('create', Post::class);

        $post = $request->user()->posts()->create($request->validated());
        $post->refresh()->load(['category', 'user']);

        return (new PostResource($post))
            ->response()
            ->setStatusCode(201);
    }

    /**
     * Get a post
     *
     * Approved and resolved posts are public. Pending and rejected posts are
     * only returned to their author and admins (404 for everyone else).
     */
    public function show(Request $request, Post $post): PostResource
    {
        // Public route, so the token is checked here instead of by middleware
        $user = Auth::guard('sanctum')->user();

        // 404 rather than 403, so unapproved posts don't reveal they exist
        abort_unless(Gate::forUser($user)->allows('view', $post), 404);

        return new PostResource($post->load(['category', 'user']));
    }

    /**
     * Update a post
     *
     * Partial update, only the fields sent are changed. Author only. Any
     * change sends the post back to moderation (status `pending`).
     * Resolved posts can't be edited.
     */
    public function update(UpdatePostRequest $request, Post $post): PostResource
    {
        Gate::authorize('update', $post);

        $post->fill($request->validated());

        if ($post->isDirty()) {
            $post->status = PostStatus::Pending;
            $post->save();
        }

        return new PostResource($post->load(['category', 'user']));
    }

    /**
     * Delete a post
     *
     * Author or admin. Also deletes the post's images.
     */
    public function destroy(Post $post): Response
    {
        Gate::authorize('delete', $post);

        $post->delete();

        return response()->noContent();
    }
}
