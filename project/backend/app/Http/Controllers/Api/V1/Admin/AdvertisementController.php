<?php

namespace App\Http\Controllers\Api\V1\Admin;

use App\Http\Controllers\Controller;
use App\Models\Advertisement;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class AdvertisementController extends Controller
{
    public function index(): JsonResponse
    {
        return response()->json([
            'data' => Advertisement::with('category')
                ->latest('id')
                ->get()
                ->map(fn (Advertisement $advertisement) => $this->serialize($advertisement)),
        ]);
    }

    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'advertiser' => ['required', 'string', 'max:120'],
            'title' => ['required', 'string', 'max:120'],
            'description' => ['required', 'string', 'max:1000'],
            'target_url' => ['required', 'url', 'max:2048', 'starts_with:https://'],
            'category_id' => ['nullable', 'integer', 'exists:categories,id'],
        ]);

        $advertisement = Advertisement::create($validated);

        return response()->json([
            'message' => 'Advertisement submitted for review.',
            'data' => $this->serialize($advertisement->load('category')),
        ], 201);
    }

    public function approve(Request $request, Advertisement $advertisement): JsonResponse
    {
        if ($advertisement->status !== 'pending') {
            return response()->json(['message' => 'Only pending advertisements can be approved.'], 422);
        }

        $advertisement->status = 'approved';
        $advertisement->reviewed_by = $request->user()->id;
        $advertisement->reviewed_at = now();
        $advertisement->save();

        return response()->json([
            'message' => 'Advertisement approved.',
            'data' => $this->serialize($advertisement->load('category')),
        ]);
    }

    public function reject(Request $request, Advertisement $advertisement): JsonResponse
    {
        if ($advertisement->status !== 'pending') {
            return response()->json(['message' => 'Only pending advertisements can be rejected.'], 422);
        }

        $advertisement->status = 'rejected';
        $advertisement->reviewed_by = $request->user()->id;
        $advertisement->reviewed_at = now();
        $advertisement->save();

        return response()->json([
            'message' => 'Advertisement rejected.',
            'data' => $this->serialize($advertisement->load('category')),
        ]);
    }

    /** @return array<string, mixed> */
    private function serialize(Advertisement $advertisement): array
    {
        return [
            'id' => $advertisement->id,
            'advertiser' => $advertisement->advertiser,
            'title' => $advertisement->title,
            'description' => $advertisement->description,
            'target_url' => $advertisement->target_url,
            'status' => $advertisement->status,
            'reviewed_at' => $advertisement->reviewed_at,
            'category' => $advertisement->category ? [
                'id' => $advertisement->category->id,
                'name' => $advertisement->category->name,
            ] : null,
        ];
    }
}
