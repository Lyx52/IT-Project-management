<?php

namespace App\Http\Resources;

use App\Models\Post;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * @mixin Post
 */
class PostResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'type' => $this->type,
            'status' => $this->status,
            'title' => $this->title,
            'description' => $this->description,
            'latitude' => $this->latitude,
            'longitude' => $this->longitude,
            'location_name' => $this->location_name,
            'event_date' => $this->event_date->format('Y-m-d'),
            'resolved_at' => $this->resolved_at,
            'images' => $this->images->map(fn ($image) => [
                'id' => $image->id,
                'url' => $image->url(),
            ])->values(),
            'category' => [
                'id' => $this->category->id,
                'name' => $this->category->name,
            ],
            'user' => [
                'id' => $this->user->id,
                'username' => $this->user->username,
            ],
            // Only on suggested matches: metres from the post they were matched to
            'distance_m' => $this->whenHas('distance_m'),
            'created_at' => $this->created_at,
            'updated_at' => $this->updated_at,
        ];
    }
}
