<?php

namespace Tests\Feature;

use App\Enums\PostStatus;
use App\Enums\PostType;
use App\Models\Post;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class AdminStatisticsTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();

        Sanctum::actingAs(User::factory()->admin()->create());
    }

    public function test_counts_posts_by_type_and_status(): void
    {
        Post::factory()->count(2)->create(['type' => PostType::Lost, 'status' => PostStatus::Approved]);
        Post::factory()->create(['type' => PostType::Found, 'status' => PostStatus::Pending]);

        $data = $this->getJson('/api/v1/admin/statistics')->assertOk()->json('data');

        $this->assertSame(3, $data['total_posts']);
        $this->assertSame(2, $data['by_type']['lost']);
        $this->assertSame(1, $data['by_type']['found']);
        $this->assertSame(2, $data['by_status']['approved']);
        $this->assertSame(1, $data['by_status']['pending']);
    }

    public function test_reports_every_status_even_when_zero(): void
    {
        $data = $this->getJson('/api/v1/admin/statistics')->assertOk()->json('data');

        foreach (['pending', 'approved', 'rejected', 'resolved'] as $status) {
            $this->assertArrayHasKey($status, $data['by_status']);
            $this->assertSame(0, $data['by_status'][$status]);
        }
    }

    public function test_averages_the_days_from_posting_to_resolution(): void
    {
        Post::factory()->create([
            'status' => PostStatus::Resolved,
            'created_at' => now()->subDays(10),
            'resolved_at' => now()->subDays(6),
        ]);
        Post::factory()->create([
            'status' => PostStatus::Resolved,
            'created_at' => now()->subDays(8),
            'resolved_at' => now()->subDays(2),
        ]);

        $data = $this->getJson('/api/v1/admin/statistics')->assertOk()->json('data');

        // 4 days and 6 days. Compared loosely because JSON renders a whole
        // number as 5 rather than 5.0.
        $this->assertEqualsWithDelta(5.0, $data['average_days_to_resolution'], 0.01);
        $this->assertSame(2, $data['resolved_count']);
    }

    public function test_the_average_is_null_when_nothing_has_been_resolved(): void
    {
        Post::factory()->create(['status' => PostStatus::Approved]);

        $data = $this->getJson('/api/v1/admin/statistics')->assertOk()->json('data');

        $this->assertNull($data['average_days_to_resolution']);
    }

    public function test_honours_the_requested_window(): void
    {
        Post::factory()->create(['created_at' => now()->subDays(100)]);
        Post::factory()->create(['created_at' => now()->subDay()]);

        $recent = $this->getJson('/api/v1/admin/statistics?from='.now()->subDays(7)->toDateString())
            ->assertOk()
            ->json('data');

        $this->assertSame(1, $recent['total_posts']);
    }

    public function test_defaults_to_the_current_month(): void
    {
        $data = $this->getJson('/api/v1/admin/statistics')->assertOk()->json('data');

        // Asserted on the reported window rather than on a count: a post "two
        // days ago" falls outside month-to-date on the 1st, which would make a
        // count-based test fail once a month.
        $this->assertSame(now()->startOfMonth()->toDateString(), $data['from']);
        $this->assertSame(today()->toDateString(), $data['to']);
    }

    public function test_rejects_a_window_that_ends_before_it_starts(): void
    {
        $this->getJson('/api/v1/admin/statistics?from=2026-11-10&to=2026-11-01')
            ->assertStatus(422)
            ->assertJsonValidationErrors('to');
    }

    public function test_contains_no_personal_data(): void
    {
        $user = User::factory()->create(['username' => 'identifiable', 'email' => 'leak@example.com']);
        Post::factory()->create(['user_id' => $user->id, 'title' => 'Secret title']);

        $body = json_encode($this->getJson('/api/v1/admin/statistics')->assertOk()->json());

        // AC-32: the figures are shareable with a sponsor.
        $this->assertStringNotContainsString('identifiable', $body);
        $this->assertStringNotContainsString('leak@example.com', $body);
        $this->assertStringNotContainsString('Secret title', $body);
    }

    public function test_never_reports_a_negative_average(): void
    {
        // Bad data: resolved before it was created.
        Post::factory()->create([
            'status' => PostStatus::Resolved,
            'created_at' => now()->subDays(2),
            'resolved_at' => now()->subDays(5),
        ]);

        $data = $this->getJson('/api/v1/admin/statistics')->assertOk()->json('data');

        $this->assertGreaterThanOrEqual(0, $data['average_days_to_resolution']);
    }

    public function test_is_closed_to_ordinary_users(): void
    {
        Sanctum::actingAs(User::factory()->create());

        $this->getJson('/api/v1/admin/statistics')->assertStatus(403);
    }
}
