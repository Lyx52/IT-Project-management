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
use Illuminate\Support\Collection;

#[Fillable(['category_id', 'type', 'title', 'description', 'latitude', 'longitude', 'location_name', 'event_date'])]
class Post extends Model
{
    /** @use HasFactory<PostFactory> */
    use HasFactory;

    /** Suggestions must be strictly closer than this. */
    public const MATCH_RADIUS_KM = 2.0;

    /** Suggestions' event dates may be at most this many days either side. */
    public const MATCH_DAYS = 7;

    /** At most this many suggestions are returned, closest first. */
    public const MATCH_LIMIT = 20;

    private const EARTH_RADIUS_KM = 6371.0;

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

    public function isApproved(): bool
    {
        return $this->status === PostStatus::Approved;
    }

    /**
     * Approved and resolved posts are public, pending and rejected ones are not.
     */
    public function isPublic(): bool
    {
        return in_array($this->status, [PostStatus::Approved, PostStatus::Resolved], true);
    }

    /**
     * Posts that might be the other half of this one: the opposite type (a
     * lost post is matched with found posts and vice versa), the same
     * category, an event date within MATCH_DAYS, closer than MATCH_RADIUS_KM,
     * approved, and not posted by the same user. Closest first, each with a
     * `distance_m` attribute.
     *
     * The database narrows the candidates to a bounding box around the post,
     * the exact great-circle distance is then worked out here, so this runs
     * the same on PostgreSQL and SQLite.
     *
     * @return Collection<int, self>
     */
    public function suggestedMatches(): Collection
    {
        $oppositeType = $this->type === PostType::Lost ? PostType::Found : PostType::Lost;

        $latDelta = rad2deg(self::MATCH_RADIUS_KM / self::EARTH_RADIUS_KM);
        $cosLat = cos(deg2rad($this->latitude));
        // Near the poles (or across the antimeridian) a longitude box doesn't
        // work, the latitude band alone still narrows it enough
        $lonDelta = $cosLat > 0.01 ? $latDelta / $cosLat : null;

        $query = self::approved()
            ->with(['category', 'user'])
            ->where('type', $oppositeType)
            ->where('category_id', $this->category_id)
            ->where('user_id', '!=', $this->user_id)
            ->whereKeyNot($this->getKey())
            ->whereBetween('event_date', [
                $this->event_date->copy()->subDays(self::MATCH_DAYS)->toDateString(),
                $this->event_date->copy()->addDays(self::MATCH_DAYS)->toDateString(),
            ])
            ->whereBetween('latitude', [$this->latitude - $latDelta, $this->latitude + $latDelta]);

        if ($lonDelta !== null && abs($this->longitude) + $lonDelta <= 180) {
            $query->whereBetween('longitude', [$this->longitude - $lonDelta, $this->longitude + $lonDelta]);
        }

        return $query->get()
            ->map(fn (self $candidate) => [
                'post' => $candidate,
                'km' => self::distanceKm($this->latitude, $this->longitude, $candidate->latitude, $candidate->longitude),
            ])
            // Compared unrounded, so 1999.6 m doesn't round up out of range
            ->filter(fn (array $match) => $match['km'] < self::MATCH_RADIUS_KM)
            ->sortBy([['km', 'asc'], ['post.id', 'asc']])
            ->take(self::MATCH_LIMIT)
            ->map(fn (array $match) => $match['post']->setAttribute('distance_m', (int) round($match['km'] * 1000)))
            ->values();
    }

    /**
     * Great-circle (haversine) distance between two points, in kilometres.
     */
    public static function distanceKm(float $lat1, float $lon1, float $lat2, float $lon2): float
    {
        $dLat = deg2rad($lat2 - $lat1);
        $dLon = deg2rad($lon2 - $lon1);

        $a = sin($dLat / 2) ** 2
            + cos(deg2rad($lat1)) * cos(deg2rad($lat2)) * sin($dLon / 2) ** 2;

        return 2 * self::EARTH_RADIUS_KM * asin(min(1.0, sqrt($a)));
    }
}
