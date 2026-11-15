<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Http\Requests\StoreSavedSearchRequest;
use App\Http\Requests\UpdateSavedSearchRequest;
use App\Http\Resources\SavedSearchResource;
use App\Models\SavedSearch;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Http\Response;
use Illuminate\Support\Facades\Gate;

class SavedSearchController extends Controller
{
    /**
     * List saved searches
     *
     * The signed-in user's saved searches, newest first. Not paginated, a
     * user has at most 20.
     */
    public function index(Request $request): AnonymousResourceCollection
    {
        $searches = $request->user()->savedSearches()
            ->with('category')
            ->latest()
            ->latest('id')
            ->get();

        return SavedSearchResource::collection($searches);
    }

    /**
     * Save a search
     *
     * Saves the current search filters (the ones `GET /posts/query` takes)
     * under a name. From then on, every newly approved post that matches
     * them creates a notification. At least one filter is required, at most
     * 20 searches per user, names are unique per user.
     */
    public function store(StoreSavedSearchRequest $request): JsonResponse
    {
        $user = $request->user();

        if ($user->savedSearches()->count() >= SavedSearch::LIMIT) {
            return response()->json([
                'message' => 'You can save at most '.SavedSearch::LIMIT.' searches. Delete one first.',
            ], 422);
        }

        $search = $user->savedSearches()->create($request->validated());

        return (new SavedSearchResource($search->load('category')))
            ->response()
            ->setStatusCode(201);
    }

    /**
     * Rename a saved search
     *
     * Only the name can change. Owner only, anyone else gets 404.
     */
    public function update(UpdateSavedSearchRequest $request, SavedSearch $savedSearch): SavedSearchResource
    {
        $savedSearch->update($request->validated());

        return new SavedSearchResource($savedSearch->load('category'));
    }

    /**
     * Delete a saved search
     *
     * Stops its notifications. Notifications it already sent are kept.
     * Owner only, anyone else gets 404.
     */
    public function destroy(SavedSearch $savedSearch): Response
    {
        Gate::authorize('manage', $savedSearch);

        $savedSearch->delete();

        return response()->noContent();
    }
}
