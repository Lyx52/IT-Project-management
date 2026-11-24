<?php

namespace Tests\Feature;

use App\Enums\PostStatus;
use App\Models\Post;
use App\Models\Report;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Notification;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class AdminModerationActionsTest extends TestCase
{
    use RefreshDatabase;

    private User $admin;

    protected function setUp(): void
    {
        parent::setUp();

        Notification::fake();

        $this->admin = User::factory()->admin()->create();
        Sanctum::actingAs($this->admin);
    }

    private function makePost(PostStatus $status): Post
    {
        return Post::factory()->create(['status' => $status]);
    }

    // --- takedown -------------------------------------------------------

    public function test_takes_down_an_approved_post(): void
    {
        $post = $this->makePost(PostStatus::Approved);

        $this->postJson("/api/v1/admin/posts/{$post->id}/takedown", ['reason' => 'Spam'])
            ->assertOk()
            ->assertJsonPath('message', 'Post taken down.');

        $post->refresh();

        $this->assertSame(PostStatus::Rejected, $post->status);
        $this->assertSame($this->admin->id, $post->reviewed_by);
        $this->assertNotNull($post->reviewed_at);
    }

    public function test_takes_down_a_resolved_post(): void
    {
        $post = $this->makePost(PostStatus::Resolved);

        $this->postJson("/api/v1/admin/posts/{$post->id}/takedown")->assertOk();

        $this->assertSame(PostStatus::Rejected, $post->refresh()->status);
    }

    public function test_removes_the_post_from_the_public_feed(): void
    {
        $post = $this->makePost(PostStatus::Approved);

        $this->postJson("/api/v1/admin/posts/{$post->id}/takedown")->assertOk();

        $ids = collect($this->getJson('/api/v1/posts')->assertOk()->json('data'))->pluck('id');

        $this->assertFalse($ids->contains($post->id));
    }

    public function test_refuses_to_take_down_a_pending_post(): void
    {
        // Pending posts were never published; rejecting is the action for those.
        $post = $this->makePost(PostStatus::Pending);

        $this->postJson("/api/v1/admin/posts/{$post->id}/takedown")
            ->assertStatus(422)
            ->assertJsonPath('message', 'Only published posts can be taken down.');

        $this->assertSame(PostStatus::Pending, $post->refresh()->status);
    }

    public function test_rejects_an_overlong_takedown_reason(): void
    {
        $post = $this->makePost(PostStatus::Approved);

        $this->postJson("/api/v1/admin/posts/{$post->id}/takedown", ['reason' => str_repeat('x', 501)])
            ->assertStatus(422)
            ->assertJsonValidationErrors('reason');
    }

    public function test_takedown_is_closed_to_ordinary_users(): void
    {
        $post = $this->makePost(PostStatus::Approved);
        Sanctum::actingAs(User::factory()->create());

        $this->postJson("/api/v1/admin/posts/{$post->id}/takedown")->assertStatus(403);

        $this->assertSame(PostStatus::Approved, $post->refresh()->status);
    }

    // --- closing a report -----------------------------------------------

    public function test_closes_a_report_and_records_the_reviewer(): void
    {
        $report = Report::create([
            'post_id' => $this->makePost(PostStatus::Approved)->id,
            'reporter_id' => User::factory()->create()->id,
            'reason' => 'Offensive',
            'status' => 'open',
        ]);

        $this->postJson("/api/v1/admin/reports/{$report->id}/close")
            ->assertOk()
            ->assertJsonPath('message', 'Report closed.')
            ->assertJsonPath('data.status', 'closed');

        $report->refresh();

        $this->assertSame('closed', $report->status);
        $this->assertSame($this->admin->id, $report->reviewed_by);
    }

    public function test_a_closed_report_leaves_the_moderation_queue(): void
    {
        $report = Report::create([
            'post_id' => $this->makePost(PostStatus::Approved)->id,
            'reporter_id' => User::factory()->create()->id,
            'reason' => 'Offensive',
            'status' => 'open',
        ]);

        $this->postJson("/api/v1/admin/reports/{$report->id}/close")->assertOk();

        $ids = collect($this->getJson('/api/v1/admin/moderation/queue')->assertOk()->json('data.open_reports'))
            ->pluck('id');

        $this->assertFalse($ids->contains($report->id));
    }

    public function test_refuses_to_close_a_report_twice(): void
    {
        $report = Report::create([
            'post_id' => $this->makePost(PostStatus::Approved)->id,
            'reporter_id' => User::factory()->create()->id,
            'reason' => 'Offensive',
            'status' => 'closed',
        ]);

        $this->postJson("/api/v1/admin/reports/{$report->id}/close")
            ->assertStatus(422)
            ->assertJsonPath('message', 'This report is already closed.');
    }

    public function test_closing_a_report_is_closed_to_ordinary_users(): void
    {
        $report = Report::create([
            'post_id' => $this->makePost(PostStatus::Approved)->id,
            'reporter_id' => User::factory()->create()->id,
            'reason' => 'Offensive',
            'status' => 'open',
        ]);

        Sanctum::actingAs(User::factory()->create());

        $this->postJson("/api/v1/admin/reports/{$report->id}/close")->assertStatus(403);

        $this->assertSame('open', $report->refresh()->status);
    }

    // --- role exposure ---------------------------------------------------

    public function test_the_current_user_endpoint_reports_the_role(): void
    {
        $this->getJson('/api/v1/user')
            ->assertOk()
            ->assertJsonPath('data.role', 'admin');
    }

    public function test_an_ordinary_user_sees_their_own_role(): void
    {
        Sanctum::actingAs(User::factory()->create());

        $this->getJson('/api/v1/user')
            ->assertOk()
            ->assertJsonPath('data.role', 'user');
    }

    // --- the moderator's reason (PB-38) ------------------------------------

    public function test_stores_the_reason_on_a_rejected_post(): void
    {
        $post = $this->makePost(PostStatus::Pending);

        $this->postJson("/api/v1/admin/posts/{$post->id}/reject", ['reason' => 'Not a lost item'])
            ->assertOk()
            ->assertJsonPath('data.rejection_reason', 'Not a lost item');

        // Kept on the post, so the author can still see it after the
        // notification is gone.
        $this->assertSame('Not a lost item', $post->refresh()->rejection_reason);
    }

    public function test_stores_the_reason_on_a_taken_down_post(): void
    {
        $post = $this->makePost(PostStatus::Approved);

        $this->postJson("/api/v1/admin/posts/{$post->id}/takedown", ['reason' => 'Spam'])->assertOk();

        $this->assertSame('Spam', $post->refresh()->rejection_reason);
    }

    public function test_a_rejection_without_a_reason_stores_null(): void
    {
        $post = $this->makePost(PostStatus::Pending);

        $this->postJson("/api/v1/admin/posts/{$post->id}/reject")->assertOk();

        $this->assertNull($post->refresh()->rejection_reason);
    }

    public function test_approving_clears_an_earlier_reason(): void
    {
        $post = $this->makePost(PostStatus::Pending);
        $post->forceFill(['rejection_reason' => 'An earlier refusal'])->save();

        $this->postJson("/api/v1/admin/posts/{$post->id}/approve")->assertOk();

        // A published post must not carry a stale refusal note.
        $this->assertNull($post->refresh()->rejection_reason);
    }

    public function test_the_author_can_see_why_their_post_was_refused(): void
    {
        $post = $this->makePost(PostStatus::Pending);
        $this->postJson("/api/v1/admin/posts/{$post->id}/reject", ['reason' => 'Duplicate'])->assertOk();

        Sanctum::actingAs($post->user);

        $this->getJson("/api/v1/post/{$post->id}")
            ->assertOk()
            ->assertJsonPath('data.rejection_reason', 'Duplicate');
    }
}
