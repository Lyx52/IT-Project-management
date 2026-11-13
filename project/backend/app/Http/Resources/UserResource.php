<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class UserResource extends JsonResource
{
    /**
     * Transform the resource into an array.
     *
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'username' => $this->username,
            'email' => $this->email,
            'email_verified_at' => $this->email_verified_at,
            // True only while verification is turned on and this address is
            // unconfirmed. Clients show the "verify your e-mail" prompt on
            // this, not on email_verified_at, which stays null while
            // verification is off.
            'must_verify_email' => $this->mustVerifyEmail(),
        ];
    }
}
