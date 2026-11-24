<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Http\Requests\StoreCategoryRequest;
use App\Http\Requests\UpdateCategoryRequest;
use App\Http\Resources\AdminCategoryResource;
use App\Http\Resources\CategoryResource;
use App\Models\Category;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Http\Response;

class CategoryController extends Controller
{
    /**
     * List categories
     *
     * Every active item category, ordered by id. Retired categories are
     * left out. Not paginated: the list is short and is used for category
     * pickers and filters.
     */
    public function query(): AnonymousResourceCollection
    {
        return CategoryResource::collection(
            Category::query()->whereNull('retired_at')->orderBy('id')->get()
        );
    }

    /**
     * List all categories (admin)
     *
     * Includes retired categories, their retirement date, and how many posts
     * use each one. The count is what tells a client which categories can be
     * deleted and which must be retired instead, so it is not optional.
     */
    public function adminIndex(): AnonymousResourceCollection
    {
        $categories = Category::query()
            ->withCount('posts')
            ->orderBy('name')
            ->get();

        return AdminCategoryResource::collection($categories);
    }

    /**
     * Add a category (admin)
     */
    public function store(StoreCategoryRequest $request): JsonResponse
    {
        $category = Category::query()->create($request->validated());

        return $this->adminResponse($category)->setStatusCode(201);
    }

    /**
     * Rename a category (admin)
     */
    public function update(UpdateCategoryRequest $request, Category $category): JsonResponse
    {
        $category->fill($request->validated());
        $category->save();

        return $this->adminResponse($category);
    }

    /**
     * Retire a category (admin)
     *
     * Retired categories cannot be chosen for new posts. Existing posts keep them.
     */
    public function retire(Category $category): JsonResponse
    {
        $category->retired_at = now();
        $category->save();

        return $this->adminResponse($category);
    }

    /**
     * Restore a retired category (admin)
     */
    public function restore(Category $category): JsonResponse
    {
        $category->retired_at = null;
        $category->save();

        return $this->adminResponse($category);
    }

    /**
     * Delete an unused category (admin)
     *
     * A category that a post uses cannot be deleted. Retire it instead.
     */
    public function destroy(Category $category): Response
    {
        abort_if(
            $category->posts()->exists(),
            409,
            'A category used by a post cannot be deleted. Retire it instead.'
        );

        $category->delete();

        return response()->noContent();
    }

    /**
     * One category in the same envelope and with the same fields as the admin
     * list, so a client can drop the response straight into the row it just
     * changed instead of refetching the whole list.
     */
    private function adminResponse(Category $category): JsonResponse
    {
        $category->refresh()->loadCount('posts');

        return AdminCategoryResource::make($category)->response();
    }
}
