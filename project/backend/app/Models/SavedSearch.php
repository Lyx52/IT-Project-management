<?php

namespace App\Models;

use App\Enums\PostType;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * A search a user saved to be notified about new posts that match it. The
 * filters are the ones GET /posts/query takes, null meaning "any".
 */
#[Fillable(['name', 'q', 'type', 'category_id'])]
class SavedSearch extends Model
{
    /** How many searches one user can save. */
    public const LIMIT = 20;

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'type' => PostType::class,
        ];
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
     * The filters in the shape Post::scopeMatchingFilters() takes.
     *
     * @return array{q: ?string, type: ?string, category_id: ?int}
     */
    public function filters(): array
    {
        return [
            'q' => $this->q,
            'type' => $this->type?->value,
            'category_id' => $this->category_id,
        ];
    }

    /**
     * Searches that could match the post, judging by everything except the
     * text, which needs Post::scopeSearch(). Leaves out the author's own
     * searches and those of banned or deleted users.
     *
     * @param  Builder<self>  $query
     */
    public function scopeCandidatesFor(Builder $query, Post $post): void
    {
        $query->where('user_id', '!=', $post->user_id)
            ->where(fn (Builder $q) => $q->whereNull('type')->orWhere('type', $post->type))
            ->where(fn (Builder $q) => $q->whereNull('category_id')->orWhere('category_id', $post->category_id))
            ->whereHas('user', fn (Builder $q) => $q->whereNull('banned_at'));
    }

    /**
     * Whether the post is in this search's results.
     */
    public function matches(Post $post): bool
    {
        return Post::approved()
            ->whereKey($post->getKey())
            ->matchingFilters($this->filters())
            ->exists();
    }
}
