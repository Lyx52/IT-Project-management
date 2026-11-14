<?php

namespace App\Models;

use App\Enums\PostStatus;
use App\Enums\PostType;
use App\Services\PostImageService;
use Database\Factories\PostFactory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

#[Fillable(['category_id', 'type', 'title', 'description', 'latitude', 'longitude', 'location_name', 'event_date'])]
class Post extends Model
{
    /** @use HasFactory<PostFactory> */
    use HasFactory;

    /**
     * Not in the fillable list: new posts always start as pending and only
     * moderation (or the owner resolving it) changes the status.
     */
    protected $attributes = [
        'status' => PostStatus::Pending->value,
    ];

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'type' => PostType::class,
            'status' => PostStatus::class,
            'latitude' => 'float',
            'longitude' => 'float',
            'event_date' => 'date:Y-m-d',
            'resolved_at' => 'datetime',
        ];
    }

    protected static function booted(): void
    {
        // Rows go with the post via the FK cascade, the files need removing by hand
        static::deleting(fn (Post $post) => app(PostImageService::class)->deleteAll($post));
    }

    /**
     * @return HasMany<PostImage, $this>
     */
    public function images(): HasMany
    {
        return $this->hasMany(PostImage::class);
    }

    /**
     * @return BelongsTo<User, $this>
     */
    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    /**
     * @return BelongsTo<Category, $this>
     */
    public function category(): BelongsTo
    {
        return $this->belongsTo(Category::class);
    }

    /**
     * Posts visible in the public feed.
     *
     * @param  Builder<self>  $query
     */
    public function scopeApproved(Builder $query): void
    {
        $query->where('status', PostStatus::Approved)
            ->whereHas('user', fn (Builder $q) => $q->whereNull('banned_at'));
    }

    /**
     * Every word must appear in the title or description. Case and diacritics
     * are ignored.
     *
     * @param  Builder<self>  $query
     */
    public function scopeSearch(Builder $query, string $text): void
    {
        $words = preg_split('/\s+/u', trim($text), -1, PREG_SPLIT_NO_EMPTY);

        foreach (array_slice($words, 0, 10) as $word) {
            // % and _ are wildcards in ILIKE, so they're matched literally
            $pattern = '%'.addcslashes($word, '\\%_').'%';

            $query->where(fn (Builder $q) => $q
                ->whereRaw('unaccent(title) ILIKE unaccent(?)', [$pattern])
                ->orWhereRaw('unaccent(description) ILIKE unaccent(?)', [$pattern]));
        }
    }

    /**
     * Approved and resolved posts are public, pending and rejected ones are not.
     */
    public function isPublic(): bool
    {
        return in_array($this->status, [PostStatus::Approved, PostStatus::Resolved], true);
    }
}
