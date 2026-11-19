<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Facades\URL;

#[Fillable(['path', 'mime_type', 'size'])]
class MessageAttachment extends Model
{
    /** How long a download link works, in minutes. */
    public const LINK_MINUTES = 15;

    /**
     * @return BelongsTo<Message, $this>
     */
    public function message(): BelongsTo
    {
        return $this->belongsTo(Message::class);
    }

    public function isVideo(): bool
    {
        return str_starts_with($this->mime_type, 'video/');
    }

    /**
     * A signed link that expires. The file sits on the private disk, so this
     * is the only way to reach it. Only the two people in the conversation
     * are ever handed one (they are the only ones who get the message).
     */
    public function temporaryUrl(): string
    {
        return URL::temporarySignedRoute(
            'message-attachments.show',
            now()->addMinutes(self::LINK_MINUTES),
            ['attachment' => $this->id],
        );
    }
}
