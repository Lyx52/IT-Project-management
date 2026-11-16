<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Http\Resources\CategoryResource;
use App\Models\Category;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;

class CategoryController extends Controller
{
    /**
     * List categories
     *
     * Every item category, ordered by id. Not paginated: the list is short
     * and is used for category pickers and filters.
     */
    public function query(): AnonymousResourceCollection
    {
        return CategoryResource::collection(Category::orderBy('id')->get());
    }
}
