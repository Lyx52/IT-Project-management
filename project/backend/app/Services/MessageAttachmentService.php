<?php

namespace App\Services;

use App\Models\Message;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use RuntimeException;

/**
 * Stores message photos and videos on the private disk as
 * attachments/<message id>/<guid>.<ext>.
 *
 * The type comes from the file's content, never from the client. Photos are
 * re-encoded, which drops EXIF/GPS metadata. Videos are stored as they are,
 * since removing their metadata would need ffmpeg.
 */
class MessageAttachmentService
{
    public const MAX_FILES = 3;

    public const MAX_IMAGE_KB = 5 * 1024;

    public const MAX_VIDEO_KB = 20 * 1024;

    public const IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

    private const EXTENSIONS = [
        'image/jpeg' => 'jpg',
        'image/png' => 'png',
        'image/webp' => 'webp',
        'video/mp4' => 'mp4',
        // What some builds of libmagic call a perfectly good mp4
        'application/mp4' => 'mp4',
        'video/webm' => 'webm',
        'video/quicktime' => 'mov',
    ];

    public function __construct(private readonly PostImageService $images) {}

    /**
     * @return array<int, string>
     */
    public static function allowedTypes(): array
    {
        return array_keys(self::EXTENSIONS);
    }

    /**
     * @param  array<int, UploadedFile>  $files
     */
    public function attach(Message $message, array $files): void
    {
        $disk = Storage::disk('local');

        foreach ($files as $file) {
            $mime = $file->getMimeType();
            $extension = self::EXTENSIONS[$mime] ?? throw new RuntimeException("Unsupported attachment type {$mime}");

            // Store it under the standard name, the database only allows image/* and video/*
            $storedMime = $mime === 'application/mp4' ? 'video/mp4' : $mime;

            $path = 'attachments/'.$message->id.'/'.Str::uuid().'.'.$extension;
            $contents = in_array($mime, self::IMAGE_TYPES, true)
                ? $this->images->stripMetadata($file, $mime)
                : (string) file_get_contents($file->getRealPath());

            $disk->put($path, $contents);

            $message->attachments()->create([
                'path' => $path,
                'mime_type' => $storedMime,
                'size' => strlen($contents),
            ]);
        }
    }
}
