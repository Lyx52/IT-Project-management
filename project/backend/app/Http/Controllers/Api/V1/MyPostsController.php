<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Http\Resources\PostResource;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;

class MyPostsController extends Controller
{
    /**
     * List my posts
     *
     * The signed-in user's own posts in every status (pending, approved,
     * rejected and resolved), newest first, 20 per page. This is how the
     * author finds the posts whose suggested matches they can see.
     */
    public function __invoke(Request $request): AnonymousResourceCollection
    {
        $posts = $request->user()->posts()
            ->with(['category', 'user', 'images'])
            ->latest()
            ->latest('id')
            ->paginate(20);

        return PostResource::collection($posts);
    }
}
