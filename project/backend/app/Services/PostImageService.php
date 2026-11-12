<?php

namespace App\Services;

use App\Models\Post;
use App\Models\PostImage;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use RuntimeException;

/**
 * Stores post photos on the public disk as posts/<post id>/<guid>.<ext>.
 *
 * Every image is decoded and re-encoded with GD, which drops all metadata
 * (EXIF, GPS, ...). The extension comes from the detected content type, never
 * from the client-supplied file name.
 */
class PostImageService
{
    public const MAX_IMAGES = 5;

    private const EXTENSIONS = [
        'image/jpeg' => 'jpg',
        'image/png' => 'png',
        'image/webp' => 'webp',
    ];

    public static function directory(Post|int $post): string
    {
        return 'posts/'.($post instanceof Post ? $post->id : $post);
    }

    /**
     * @param  array<int, UploadedFile>  $files
     */
    public function attach(Post $post, array $files): void
    {
        $disk = Storage::disk('public');

        foreach ($files as $file) {
            $mime = $file->getMimeType();
            $extension = self::EXTENSIONS[$mime] ?? throw new RuntimeException("Unsupported image type {$mime}");

            $path = self::directory($post).'/'.Str::uuid().'.'.$extension;
            $disk->put($path, $this->stripMetadata($file, $mime));

            $post->images()->create(['path' => $path]);
        }
    }

    public function deleteImage(PostImage $image): void
    {
        Storage::disk('public')->delete($image->path);
        $image->delete();
    }

    public function deleteAll(Post $post): void
    {
        Storage::disk('public')->deleteDirectory(self::directory($post));
    }

    private function stripMetadata(UploadedFile $file, string $mime): string
    {
        $image = @imagecreatefromstring((string) file_get_contents($file->getRealPath()));

        if ($image === false) {
            throw new RuntimeException('Could not decode image');
        }

        // Apply the EXIF orientation first, otherwise stripping it rotates the photo
        if ($mime === 'image/jpeg' && function_exists('exif_read_data')) {
            $orientation = @exif_read_data($file->getRealPath())['Orientation'] ?? 1;
            $image = match ($orientation) {
                3 => imagerotate($image, 180, 0),
                6 => imagerotate($image, -90, 0),
                8 => imagerotate($image, 90, 0),
                default => $image,
            };
        }

        ob_start();
        match ($mime) {
            'image/jpeg' => imagejpeg($image, null, 85),
            'image/png' => (function () use ($image) {
                imagealphablending($image, false);
                imagesavealpha($image, true);
                imagepng($image);
            })(),
            'image/webp' => imagewebp($image, null, 85),
        };

        return (string) ob_get_clean();
    }
}
