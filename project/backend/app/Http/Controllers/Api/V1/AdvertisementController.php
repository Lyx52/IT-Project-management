<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\Advertisement;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class AdvertisementController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'category_id' => ['sometimes', 'nullable', 'integer', 'exists:categories,id'],
        ]);

        $categoryId = $validated['category_id'] ?? null;

        $query = Advertisement::query()
            ->where('status', 'approved')
            ->where(function ($query) use ($categoryId) {
                $query->whereNull('category_id');

                if ($categoryId !== null) {
                    $query->orWhere('category_id', $categoryId);
                }
            })
            ->with('category');

        if ($categoryId !== null) {
            $query->orderByRaw('CASE WHEN category_id = ? THEN 0 ELSE 1 END', [$categoryId]);
        }

        $advertisement = $query->inRandomOrder()->first();

        return response()->json([
            'data' => $advertisement ? [
                'id' => $advertisement->id,
                'advertiser' => $advertisement->advertiser,
                'title' => $advertisement->title,
                'description' => $advertisement->description,
                'target_url' => $advertisement->target_url,
                'category' => $advertisement->category ? [
                    'id' => $advertisement->category->id,
                    'name' => $advertisement->category->name,
                ] : null,
            ] : null,
        ]);
    }
}
