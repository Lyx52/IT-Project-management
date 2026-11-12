<?php

namespace App\Models;

use App\Notifications\VerifyEmailNotification;
use Database\Factories\UserFactory;
use Illuminate\Contracts\Auth\MustVerifyEmail;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Attributes\Hidden;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Prunable;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Laravel\Sanctum\HasApiTokens;

#[Fillable(['username', 'email', 'password', 'terms_accepted_at', 'privacy_policy_version'])]
#[Hidden(['password', 'remember_token'])]
class User extends Authenticatable implements MustVerifyEmail
{
    /** @use HasFactory<UserFactory> */
    use HasApiTokens, HasFactory, Notifiable, Prunable, SoftDeletes;

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
            'terms_accepted_at' => 'datetime',
        ];
    }

    /**
     * @return HasMany<Post, $this>
     */
    public function posts(): HasMany
    {
        return $this->hasMany(Post::class);
    }

    /**
     * Also called by Laravel's listener for the Registered event. Sends nothing
     * while verification is turned off (config/verification.php).
     */
    public function sendEmailVerificationNotification(): void
    {
        if (! config('verification.enabled')) {
            return;
        }

        $this->notify(new VerifyEmailNotification);
    }

    /**
     * Whether this account is blocked from posting until it verifies its
     * address. Always false while verification is turned off.
     */
    public function mustVerifyEmail(): bool
    {
        return config('verification.enabled') && ! $this->hasVerifiedEmail();
    }

    public function isAdmin(): bool
    {
        return $this->role === 'admin';
    }

    /**
     * Soft-deleted accounts that are due for permanent deletion. The daily
     * model:prune run (routes/console.php) force-deletes them, and the
     * database cascades to their posts, images and messages.
     * The delay is config('retention.account_purge_days'), see config/retention.php.
     *
     * @return Builder<self>
     */
    public function prunable(): Builder
    {
        return static::onlyTrashed()
            ->where('deleted_at', '<=', now()->subDays(config('retention.account_purge_days')));
    }

    /**
     * Deletes the files of everything the database is about to cascade-delete.
     * Rows don't take their files with them.
     */
    protected function pruning(): void
    {
        // Both directions: the cascade deletes messages the user sent and received
        $messageIds = DB::table('messages')
            ->where('sender_id', $this->id)
            ->orWhere('receiver_id', $this->id)
            ->pluck('id');

        $paths = collect([$this->avatar_path])
            ->merge(
                DB::table('post_images')
                    ->join('posts', 'posts.id', '=', 'post_images.post_id')
                    ->where('posts.user_id', $this->id)
                    ->pluck('post_images.path')
            )
            ->merge(DB::table('message_attachments')->whereIn('message_id', $messageIds)->pluck('path'))
            ->filter()
            ->unique()
            ->values()
            ->all();

        if ($paths !== []) {
            Storage::disk('local')->delete($paths);
        }
    }
}
