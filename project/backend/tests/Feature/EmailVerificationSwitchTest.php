<?php

namespace Tests\Feature;

use App\Models\Category;
use App\Models\User;
use App\Notifications\VerifyEmailNotification;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Notification;
use Illuminate\Testing\TestResponse;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

/**
 * config('verification.enabled') turns e-mail verification off until the
 * project has a mail domain, without removing it.
 */
class EmailVerificationSwitchTest extends TestCase
{
    use RefreshDatabase;

    private function createPost(): TestResponse
    {
        return $this->postJson('/api/v1/posts', [
            'type' => 'lost',
            'category_id' => Category::firstOrFail()->id,
            'title' => 'Black umbrella',
            'description' => 'Left on the tram.',
            'latitude' => 56.95,
            'longitude' => 24.1,
            'event_date' => now()->toDateString(),
        ]);
    }

    public function test_an_unverified_account_can_post_while_verification_is_off(): void
    {
        config(['verification.enabled' => false]);
        Sanctum::actingAs(User::factory()->unverified()->create());

        $this->createPost()->assertCreated();
    }

    public function test_an_unverified_account_cannot_post_while_verification_is_on(): void
    {
        config(['verification.enabled' => true]);
        Sanctum::actingAs(User::factory()->unverified()->create());

        $this->createPost()
            ->assertForbidden()
            ->assertJsonPath('message', 'Your email address is not verified.');
    }

    public function test_a_verified_account_can_post_while_verification_is_on(): void
    {
        config(['verification.enabled' => true]);
        Sanctum::actingAs(User::factory()->create());

        $this->createPost()->assertCreated();
    }

    public function test_posting_still_needs_a_sign_in_while_verification_is_off(): void
    {
        config(['verification.enabled' => false]);

        $this->createPost()->assertUnauthorized();
    }

    public function test_resend_answers_404_while_verification_is_off(): void
    {
        config(['verification.enabled' => false]);
        Notification::fake();
        Sanctum::actingAs(User::factory()->unverified()->create());

        $this->postJson('/api/v1/email/resend')->assertNotFound();

        Notification::assertNothingSent();
    }

    public function test_resend_sends_the_e_mail_while_verification_is_on(): void
    {
        config(['verification.enabled' => true]);
        Notification::fake();
        Sanctum::actingAs($user = User::factory()->unverified()->create());

        $this->postJson('/api/v1/email/resend')->assertStatus(202);

        Notification::assertSentTo($user, VerifyEmailNotification::class);
    }

    public function test_tells_the_client_whether_the_user_must_verify(): void
    {
        $user = User::factory()->unverified()->create();
        Sanctum::actingAs($user);

        config(['verification.enabled' => false]);
        $this->getJson('/api/v1/user')->assertJsonPath('data.must_verify_email', false);

        config(['verification.enabled' => true]);
        $this->getJson('/api/v1/user')->assertJsonPath('data.must_verify_email', true);

        $user->markEmailAsVerified();
        $this->getJson('/api/v1/user')->assertJsonPath('data.must_verify_email', false);
    }
}
