<?php

namespace Tests\Feature;

use App\Enums\PostStatus;
use App\Models\Post;
use App\Models\Report;
use App\Models\User;
use App\Notifications\ReportReviewedNotification;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Notification;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

/** Closing a report tells whoever reported it what happened. */
class ReportReviewedNotificationTest extends TestCase
{
    use RefreshDatabase;

    private User $admin;

    private User $reporter;

    protected function setUp(): void
    {
        parent::setUp();

        $this->admin = User::factory()->admin()->create();
        $this->reporter = User::factory()->create();

        Sanctum::actingAs($this->admin);
    }

    private function reportOn(PostStatus $status = PostStatus::Approved): Report
    {
        $post = Post::factory()->create(['status' => $status]);

        return Report::create([
            'post_id' => $post->id,
            'reporter_id' => $this->reporter->id,
            'reason' => 'Offensive content',
            'status' => 'open',
        ]);
    }

    public function test_tells_the_reporter_when_a_moderator_acted(): void
    {
        Notification::fake();
        $report = $this->reportOn();

        $this->postJson("/api/v1/admin/reports/{$report->id}/close", ['outcome' => 'action_taken'])
            ->assertOk();

        Notification::assertSentTo(
            $this->reporter,
            fn (ReportReviewedNotification $notification) => $notification->outcome === 'action_taken'
        );
    }

    public function test_tells_the_reporter_when_the_post_was_left_alone(): void
    {
        Notification::fake();
        $report = $this->reportOn();

        $this->postJson("/api/v1/admin/reports/{$report->id}/close", ['outcome' => 'dismissed'])
            ->assertOk();

        Notification::assertSentTo(
            $this->reporter,
            fn (ReportReviewedNotification $notification) => $notification->outcome === 'dismissed'
        );
    }

    public function test_works_out_the_outcome_when_the_caller_does_not_say(): void
    {
        Notification::fake();

        // The post was taken down first, so this was not a dismissal
        $report = $this->reportOn(PostStatus::Rejected);

        $this->postJson("/api/v1/admin/reports/{$report->id}/close")->assertOk();

        Notification::assertSentTo(
            $this->reporter,
            fn (ReportReviewedNotification $notification) => $notification->outcome === 'action_taken'
        );
    }

    public function test_refuses_an_outcome_it_does_not_recognise(): void
    {
        Notification::fake();
        $report = $this->reportOn();

        $this->postJson("/api/v1/admin/reports/{$report->id}/close", ['outcome' => 'banned_them'])
            ->assertStatus(422)
            ->assertJsonValidationErrors('outcome');

        Notification::assertNothingSent();
    }

    public function test_says_nothing_when_the_reporter_has_gone(): void
    {
        Notification::fake();
        $report = $this->reportOn();

        // reporter_id is null on delete, so there is nobody to tell
        $report->forceFill(['reporter_id' => null])->save();

        $this->postJson("/api/v1/admin/reports/{$report->id}/close")->assertOk();

        Notification::assertNothingSent();
    }

    public function test_the_notification_names_nobody(): void
    {
        $report = $this->reportOn();
        $author = $report->post->user;

        $this->postJson("/api/v1/admin/reports/{$report->id}/close", ['outcome' => 'dismissed'])
            ->assertOk();

        $payload = json_encode($this->reporter->notifications()->first()->data);

        // AC: notifications carry no personal data
        $this->assertStringNotContainsString($author->username, $payload);
        $this->assertStringNotContainsString($author->email, $payload);
        $this->assertStringNotContainsString($this->reporter->username, $payload);
    }

    public function test_a_second_close_notifies_nobody_again(): void
    {
        Notification::fake();
        $report = $this->reportOn();

        $this->postJson("/api/v1/admin/reports/{$report->id}/close")->assertOk();
        Notification::assertSentToTimes($this->reporter, ReportReviewedNotification::class, 1);

        $this->postJson("/api/v1/admin/reports/{$report->id}/close")->assertStatus(422);
        Notification::assertSentToTimes($this->reporter, ReportReviewedNotification::class, 1);
    }
}
