<?php

namespace Tests\Feature;

use App\Enums\PostStatus;
use App\Enums\PostType;
use App\Models\Category;
use App\Models\Post;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class PostMatchesTest extends TestCase
{
    use RefreshDatabase;

    // Riga centre
    private const LAT = 56.95;

    private const LON = 24.1;

    // One kilometre north, in degrees of latitude
    private const KM_NORTH = 1 / 111.195;

    private User $owner;

    private Post $lost;

    protected function setUp(): void
    {
        parent::setUp();

        $this->owner = User::factory()->create();
        $this->lost = $this->makePost(['type' => PostType::Lost], $this->owner);
    }

    /**
     * An approved found post that matches $this->lost on every criterion,
     * unless overridden.
     */
    private function makePost(array $attributes = [], ?User $user = null): Post
    {
        return Post::factory()
            ->for($user ?? User::factory())
            ->create(array_merge([
                'type' => PostType::Found,
                'status' => PostStatus::Approved,
                'category_id' => $this->category('Keys'),
                'latitude' => self::LAT,
                'longitude' => self::LON,
                'event_date' => '2026-11-01',
            ], $attributes));
    }

    private function category(string $name): int
    {
        return Category::where('name', $name)->value('id');
    }

    private function kmNorth(float $km): float
    {
        return round(self::LAT + $km * self::KM_NORTH, 5);
    }

    /**
     * @return list<int>
     */
    private function matchIds(?Post $post = null): array
    {
        $post ??= $this->lost;
        Sanctum::actingAs($post->user);

        return $this->getJson("/api/v1/post/{$post->id}/matches")
            ->assertOk()
            ->json('data.*.id');
    }

    public function test_suggests_found_posts_ordered_by_distance(): void
    {
        $far = $this->makePost(['latitude' => $this->kmNorth(1.5)]);
        $near = $this->makePost(['latitude' => $this->kmNorth(0.3)]);
        $middle = $this->makePost(['latitude' => $this->kmNorth(1.0)]);

        Sanctum::actingAs($this->owner);

        $response = $this->getJson("/api/v1/post/{$this->lost->id}/matches")->assertOk();

        $this->assertSame([$near->id, $middle->id, $far->id], $response->json('data.*.id'));

        // Five decimal places of latitude are about a metre
        $this->assertEqualsWithDelta(300, $response->json('data.0.distance_m'), 2);
        $this->assertEqualsWithDelta(1500, $response->json('data.2.distance_m'), 2);
        $response->assertJsonPath('data.0.category.name', 'Keys');
    }

    public function test_found_posts_get_lost_posts(): void
    {
        $found = $this->makePost();
        $this->makePost();

        $this->assertSame([$this->lost->id], $this->matchIds($found));
    }

    public function test_only_suggests_the_same_category(): void
    {
        $this->makePost(['category_id' => $this->category('Phones')]);
        $keys = $this->makePost();

        $this->assertSame([$keys->id], $this->matchIds());
    }

    public function test_only_suggests_the_opposite_type(): void
    {
        $this->makePost(['type' => PostType::Lost]);
        $found = $this->makePost();

        $this->assertSame([$found->id], $this->matchIds());
    }

    public function test_only_suggests_dates_within_seven_days(): void
    {
        $weekBefore = $this->makePost(['event_date' => '2026-10-25']);
        $weekAfter = $this->makePost(['event_date' => '2026-11-08']);
        $this->makePost(['event_date' => '2026-10-24']);
        $this->makePost(['event_date' => '2026-11-09']);

        $this->assertEqualsCanonicalizing([$weekBefore->id, $weekAfter->id], $this->matchIds());
    }

    public function test_only_suggests_posts_under_two_kilometres(): void
    {
        $inside = $this->makePost(['latitude' => $this->kmNorth(1.95)]);
        $this->makePost(['latitude' => $this->kmNorth(2.05)]);
        $this->makePost(['latitude' => $this->kmNorth(-2.05)]);
        // East-west too: a degree of longitude is shorter than one of latitude here
        $this->makePost(['longitude' => round(self::LON + 2.05 * self::KM_NORTH / cos(deg2rad(self::LAT)), 5)]);
        $east = $this->makePost(['longitude' => round(self::LON + 1.95 * self::KM_NORTH / cos(deg2rad(self::LAT)), 5)]);

        $this->assertEqualsCanonicalizing([$inside->id, $east->id], $this->matchIds());
    }

    public function test_only_suggests_approved_posts(): void
    {
        $approved = $this->makePost();
        $this->makePost(['status' => PostStatus::Pending]);
        $this->makePost(['status' => PostStatus::Rejected]);
        $this->makePost(['status' => PostStatus::Resolved, 'resolved_at' => now()]);

        $this->assertSame([$approved->id], $this->matchIds());
    }

    public function test_never_suggests_the_authors_own_posts(): void
    {
        $this->makePost([], $this->owner);

        $this->assertSame([], $this->matchIds());
    }

    public function test_works_while_the_post_awaits_moderation(): void
    {
        $this->lost->forceFill(['status' => PostStatus::Pending])->save();
        $found = $this->makePost();

        $this->assertSame([$found->id], $this->matchIds());
    }

    public function test_returns_at_most_the_limit(): void
    {
        Post::factory()
            ->count(Post::MATCH_LIMIT + 1)
            ->sequence(fn ($sequence) => ['latitude' => $this->kmNorth(0.05 * ($sequence->index + 1))])
            ->create([
                'type' => PostType::Found,
                'status' => PostStatus::Approved,
                'category_id' => $this->category('Keys'),
                'longitude' => self::LON,
                'event_date' => '2026-11-01',
            ]);

        $ids = $this->matchIds();

        $this->assertCount(Post::MATCH_LIMIT, $ids);
    }

    public function test_is_only_for_the_author_and_admins(): void
    {
        $this->makePost();

        $this->getJson("/api/v1/post/{$this->lost->id}/matches")->assertUnauthorized();

        Sanctum::actingAs(User::factory()->create());
        $this->getJson("/api/v1/post/{$this->lost->id}/matches")->assertForbidden();

        Sanctum::actingAs(User::factory()->admin()->create());
        $this->getJson("/api/v1/post/{$this->lost->id}/matches")->assertOk()->assertJsonCount(1, 'data');
    }

    public function test_the_feed_has_no_distance(): void
    {
        $this->makePost();

        $this->getJson('/api/v1/posts')->assertOk()->assertJsonMissingPath('data.0.distance_m');
    }

    public function test_distance_is_haversine(): void
    {
        // A degree of latitude is about 111.2 km anywhere
        $this->assertEqualsWithDelta(111.195, Post::distanceKm(56, 24, 57, 24), 0.01);
        $this->assertSame(0.0, Post::distanceKm(self::LAT, self::LON, self::LAT, self::LON));
    }
}
