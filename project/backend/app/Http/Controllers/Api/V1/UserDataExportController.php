<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\Message;
use App\Models\Post;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;

class UserDataExportController extends Controller
{
    /**
     * Download the signed-in user's personal data as a JSON attachment.
     * Files are embedded as base64 so the export is self-contained.
     * Other participants are anonymized in conversations.
     */
    public function __invoke(Request $request): JsonResponse
    {
        /** @var User $user */
        $user = $request->user();

        $posts = $user->posts()->with(['category', 'images'])->orderBy('id')->get();
        $messages = Message::query()
            ->where(fn ($query) => $query
                ->where('sender_id', $user->id)
                ->orWhere('receiver_id', $user->id))
            ->orderBy('id')
            ->get();

        $attachments = $messages->isEmpty()
            ? collect()
            : DB::table('message_attachments')
                ->whereIn('message_id', $messages->modelKeys())
                ->orderBy('id')
                ->get()
                ->groupBy('message_id');

        $export = [
            'exported_at' => now()->toIso8601String(),
            'account' => [
                'id' => $user->id,
                'username' => $user->username,
                'email' => $user->email,
                'role' => $user->role,
                'email_verified_at' => $user->email_verified_at?->toIso8601String(),
                'banned_at' => $user->banned_at?->toIso8601String(),
                'terms_accepted_at' => $user->terms_accepted_at?->toIso8601String(),
                'privacy_policy_version' => $user->privacy_policy_version,
                'avatar' => $this->exportFile('local', $user->avatar_path),
                'created_at' => $user->created_at?->toIso8601String(),
                'updated_at' => $user->updated_at?->toIso8601String(),
            ],
            'posts' => $posts->map(fn (Post $post) => [
                'id' => $post->id,
                'category' => $post->category->name,
                'type' => $post->type->value,
                'status' => $post->status->value,
                'title' => $post->title,
                'description' => $post->description,
                'latitude' => $post->latitude,
                'longitude' => $post->longitude,
                'location_name' => $post->location_name,
                'event_date' => $post->event_date?->toDateString(),
                'resolved_at' => $post->resolved_at?->toIso8601String(),
                'images' => $post->images->map(fn ($image) => [
                    'id' => $image->id,
                    'file' => $this->exportFile('public', $image->path),
                ])->values(),
                'created_at' => $post->created_at?->toIso8601String(),
                'updated_at' => $post->updated_at?->toIso8601String(),
            ])->values(),
            'messages' => $messages->map(function (Message $message) use ($user, $attachments): array {
                /** @var Collection<int, object> $messageAttachments */
                $messageAttachments = $attachments->get($message->id, collect());

                return [
                    'id' => $message->id,
                    'direction' => (int) $message->sender_id === (int) $user->id ? 'sent' : 'received',
                    'counterpart' => 'anonymous',
                    'body' => $message->body,
                    'attachments' => $messageAttachments->map(fn (object $attachment) => [
                        'file' => $this->exportFile('local', $attachment->path),
                    ])->values(),
                    'read_at' => $message->read_at?->toIso8601String(),
                    'created_at' => $message->created_at?->toIso8601String(),
                ];
            })->values(),
        ];

        return response()->json($export)
            ->header('Content-Disposition', 'attachment; filename="personal-data-'.$user->id.'.json"');
    }

    /**
     * Include a stored file as base64 without exposing its storage path.
     *
     * @return array{filename: string, mime_type: string, encoding: string, content: string}|null
     */
    private function exportFile(string $disk, ?string $path): ?array
    {
        if (! $path || ! Storage::disk($disk)->exists($path)) {
            return null;
        }

        $storage = Storage::disk($disk);

        return [
            'filename' => basename($path),
            'mime_type' => $storage->mimeType($path) ?: 'application/octet-stream',
            'encoding' => 'base64',
            'content' => base64_encode($storage->get($path)),
        ];
    }
}
