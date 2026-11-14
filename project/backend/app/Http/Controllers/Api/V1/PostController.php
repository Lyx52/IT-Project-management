<?php

namespace App\Http\Controllers\Api\V1;

use App\Enums\PostStatus;
use App\Http\Controllers\Controller;
use App\Http\Requests\StorePostRequest;
use App\Http\Requests\UpdatePostRequest;
use App\Http\Resources\PostResource;
use App\Models\Post;
use App\Services\PostImageService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Http\Response;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
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
            ->with(['category', 'user', 'images'])
            ->latest()
            ->latest('id')
            ->paginate(20);

        return PostResource::collection($posts);
    }

    /**
     * Create a post
     *
     * Send as `multipart/form-data` to attach up to 5 photos (`images[]`,
     * jpg/png/webp, max 5 MB each). File names are randomised and EXIF/GPS
     * metadata is stripped.
     *
     * The post is saved with status `pending` and appears in the feed once a
     * moderator approves it.
     */
    public function store(StorePostRequest $request, PostImageService $images): JsonResponse
    {
        Gate::authorize('create', Post::class);

        $post = DB::transaction(function () use ($request, $images) {
            $post = $request->user()->posts()->create($request->safe()->except('images'));
            $images->attach($post, $request->file('images', []));

            return $post;
        });
        $post->refresh()->load(['category', 'user', 'images']);

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

        return new PostResource($post->load(['category', 'user', 'images']));
    }

    /**
     * Suggested matches for a post
     *
     * Posts that might be the other half of this one, so the author doesn't
     * have to search: the opposite type (lost posts get found posts and vice
     * versa), the same category, an event date at most 7 days either side,
     * less than 2 km away, approved, and not by the same user. Ordered by
     * distance, closest first, at most 20. Each has `distance_m`, the
     * distance in metres. Author or admin only.
     */
    public function matches(Post $post): AnonymousResourceCollection
    {
        Gate::authorize('viewMatches', $post);

        return PostResource::collection($post->suggestedMatches());
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

        return new PostResource($post->load(['category', 'user', 'images']));
    }

    /**
     * Resolve a post
     *
     * Author only. Marks an approved post as resolved and records the time.
     * The post leaves the public feed but stays reachable by its link, and
     * can no longer be edited.
     */
    public function resolve(Post $post): PostResource
    {
        Gate::authorize('resolve', $post);

        $post->status = PostStatus::Resolved;
        $post->resolved_at = now();
        $post->save();

        return new PostResource($post->load(['category', 'user', 'images']));
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
