<?php

namespace App\Models;

// use Illuminate\Contracts\Auth\MustVerifyEmail;
use Database\Factories\UserFactory;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Attributes\Hidden;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Prunable;
use Illuminate\Database\Eloquent\SoftDeletes;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;

#[Fillable(['name', 'email', 'password'])]
#[Hidden(['password', 'remember_token'])]
class User extends Authenticatable
{
    /** @use HasFactory<UserFactory> */
    use HasFactory, Notifiable, Prunable, SoftDeletes;

    /**
     * Get the attributes that should be cast.
     *
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'email_verified_at' => 'datetime',
            'password' => 'hashed',
        ];
    }

    /**
     * @return Builder<self>
     */
    public function prunable(): Builder
    {
        return static::onlyTrashed()
            ->where('deleted_at', '<=', now()->subDays(22));
    }

    protected function pruning(): void
    {
        $paths = collect([$this->avatar_path])
            ->merge(
                DB::table('post_images')
                    ->join('posts', 'posts.id', '=', 'post_images.post_id')
                    ->where('posts.user_id', $this->id)
                    ->pluck('post_images.path')
            )
            ->merge(
                DB::table('message_attachments')
                    ->join('messages', 'messages.id', '=', 'message_attachments.message_id')
                    ->where('messages.user_id', $this->id)
                    ->pluck('message_attachments.path')
            )
            ->filter()
            ->unique()
            ->values()
            ->all();

        if ($paths !== []) {
            Storage::disk('local')->delete($paths);
        }
    }
}
