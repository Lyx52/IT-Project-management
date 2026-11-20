<?php

namespace Tests\Feature;

use App\Enums\PostStatus;
use App\Models\Post;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/** GET /api/v1/posts - the home feed. */
class PostFeedTest extends TestCase
{
    use RefreshDatabase;

    private function approved(array $attributes = []): Post
    {
        return Post::factory()->create(array_merge([
            'status' => PostStatus::Approved,
        ], $attributes));
    }

    public function test_orders_by_approval_rather_than_submission(): void
    {
        // Waited in the moderation queue, published today
        $waited = $this->approved([
            'title' => 'Waited in the queue',
            'created_at' => now()->subDays(10),
            'reviewed_at' => now(),
        ]);

        // Submitted later, but published before it
        $quick = $this->approved([
            'title' => 'Approved earlier',
            'created_at' => now()->subDay(),
            'reviewed_at' => now()->subDay(),
        ]);

        $titles = collect($this->getJson('/api/v1/posts')->assertOk()->json('data'))
            ->pluck('title')
            ->all();

        $this->assertSame([$waited->title, $quick->title], $titles);
    }

    public function test_falls_back_to_creation_when_never_reviewed(): void
    {
        // Approved rows predating reviewed_at must not sink to the bottom
        $old = $this->approved([
            'title' => 'No review stamp, old',
            'created_at' => now()->subDays(5),
            'reviewed_at' => null,
        ]);
        $new = $this->approved([
            'title' => 'No review stamp, recent',
            'created_at' => now()->subHour(),
            'reviewed_at' => null,
        ]);

        $titles = collect($this->getJson('/api/v1/posts')->assertOk()->json('data'))
            ->pluck('title')
            ->all();

        $this->assertSame([$new->title, $old->title], $titles);
    }

    public function test_shows_at_most_twenty(): void
    {
        $this->approved(['reviewed_at' => now()]);
        Post::factory()->count(25)->create([
            'status' => PostStatus::Approved,
            'reviewed_at' => now()->subMinute(),
        ]);

        $response = $this->getJson('/api/v1/posts')->assertOk();

        $this->assertCount(20, $response->json('data'));
        $this->assertSame(20, $response->json('meta.per_page'));
        $this->assertSame(26, $response->json('meta.total'));
    }

    public function test_shows_only_approved_posts(): void
    {
        $this->approved(['title' => 'Published']);

        foreach ([PostStatus::Pending, PostStatus::Rejected] as $status) {
            Post::factory()->create(['status' => $status, 'title' => 'Hidden '.$status->value]);
        }

        $titles = collect($this->getJson('/api/v1/posts')->assertOk()->json('data'))
            ->pluck('title')
            ->all();

        $this->assertSame(['Published'], $titles);
    }

    public function test_hides_posts_by_a_banned_author(): void
    {
        $banned = User::factory()->create();
        $banned->forceFill(['banned_at' => now()])->save();

        $this->approved(['title' => 'Still visible']);
        $this->approved(['title' => 'From a banned account', 'user_id' => $banned->id]);

        $titles = collect($this->getJson('/api/v1/posts')->assertOk()->json('data'))
            ->pluck('title')
            ->all();

        $this->assertSame(['Still visible'], $titles);
    }
}
