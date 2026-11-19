<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\MessageAttachment;
use Illuminate\Support\Facades\Storage;
use Symfony\Component\HttpFoundation\BinaryFileResponse;

class MessageAttachmentController extends Controller
{
    /**
     * Download a message attachment
     *
     * Needs the signed, expiring `url` that comes with the message, so it can
     * be used straight in an `<img>` or `<video>` tag. Without a valid
     * signature, or after it expires, the answer is `403`. The files are on
     * the private disk and have no other address.
     */
    public function show(MessageAttachment $attachment): BinaryFileResponse
    {
        $disk = Storage::disk('local');

        abort_unless($disk->exists($attachment->path), 404);

        return response()->file($disk->path($attachment->path), [
            'Content-Type' => $attachment->mime_type,
            'X-Content-Type-Options' => 'nosniff',
            'Cache-Control' => 'private, max-age='.(MessageAttachment::LINK_MINUTES * 60),
        ]);
    }
}
