<?php

namespace App\Http\Resources;

use App\Models\Message;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * Deliberately exposes ids and usernames only: neither party ever gets the
 * other's e-mail address.
 *
 * @mixin Message
 */
class MessageResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'post_id' => $this->post_id,
            'body' => $this->body,
            'sender' => ['id' => $this->sender->id, 'username' => $this->sender->username],
            'receiver' => ['id' => $this->receiver->id, 'username' => $this->receiver->username],
            'attachments' => $this->whenLoaded('attachments', fn () => $this->attachments->map(fn ($attachment) => [
                'id' => $attachment->id,
                'type' => $attachment->isVideo() ? 'video' : 'image',
                'mime_type' => $attachment->mime_type,
                'size' => $attachment->size,
                // Expires, see MessageAttachment::temporaryUrl()
                'url' => $attachment->temporaryUrl(),
            ])->values()),
            'read_at' => $this->read_at,
            'created_at' => $this->created_at,
        ];
    }
}
