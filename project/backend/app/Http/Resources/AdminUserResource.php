<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * A user as shown in the admin user list. Separate from UserResource because
 * this exposes moderation state about *other* people, so it must never be
 * reachable outside the admin routes.
 */
class AdminUserResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'username' => $this->username,
            'email' => $this->email,
            'role' => $this->role,
            'banned_at' => $this->banned_at,
            'email_verified_at' => $this->email_verified_at,
            'posts_count' => $this->posts_count ?? 0,
            'created_at' => $this->created_at,
        ];
    }
}
