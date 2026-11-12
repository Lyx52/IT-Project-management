<?php

namespace Tests\Feature;

use App\Models\User;
use App\Notifications\VerifyEmailNotification;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Notification;
use Illuminate\Testing\TestResponse;
use Tests\Concerns\SolvesCaptcha;
use Tests\TestCase;

class RegisterTest extends TestCase
{
    use RefreshDatabase, SolvesCaptcha;

    private const PASSWORD = 'correct horse';

    protected function setUp(): void
    {
        parent::setUp();

        Notification::fake();
    }

    /**
     * @param  array<string, mixed>|null  $captcha  null solves a fresh challenge
     */
    private function register(array $overrides = [], ?array $captcha = null): TestResponse
    {
        $captcha ??= $this->solvedCaptcha();

        return $this->postJson('/api/v1/register', array_merge([
            'username' => 'jane_doe',
            'email' => 'jane@example.com',
            'password' => self::PASSWORD,
            'password_confirmation' => self::PASSWORD,
            'terms_accepted' => true,
            'privacy_policy_version' => '1.0',
            'captcha_id' => $captcha['captcha_id'],
            'captcha_answer' => $captcha['captcha_answer'],
        ], $overrides));
    }

    public function test_creates_an_account_with_a_solved_captcha(): void
    {
        $this->register()
            ->assertCreated()
            ->assertJsonPath('data.username', 'jane_doe')
            ->assertJsonPath('data.email', 'jane@example.com');

        $this->assertDatabaseHas('users', ['email' => 'jane@example.com']);
    }

    public function test_never_returns_a_token(): void
    {
        $this->register()->assertCreated()->assertJsonMissingPath('access_token');
    }

    public function test_refuses_a_wrong_answer_and_creates_no_account(): void
    {
        $captcha = $this->solvedCaptcha();
        $captcha['captcha_answer'] = (string) ((int) $captcha['captcha_answer'] + 1);

        $this->register([], $captcha)
            ->assertStatus(422)
            ->assertJsonValidationErrors(['captcha_answer' => 'not correct']);

        $this->assertDatabaseCount('users', 0);
    }

    public function test_refuses_a_missing_captcha(): void
    {
        $this->register([], ['captcha_id' => null, 'captcha_answer' => null])
            ->assertStatus(422)
            ->assertJsonValidationErrors('captcha_answer');

        $this->assertDatabaseCount('users', 0);
    }

    public function test_refuses_an_expired_captcha(): void
    {
        $captcha = $this->solvedCaptcha();

        $this->travel(config('captcha.ttl_seconds') + 1)->seconds();

        $this->register([], $captcha)
            ->assertStatus(422)
            ->assertJsonValidationErrors(['captcha_answer' => 'expired']);
    }

    public function test_a_solved_captcha_cannot_create_a_second_account(): void
    {
        $captcha = $this->solvedCaptcha();

        $this->register([], $captcha)->assertCreated();

        $this->register(['username' => 'bot_2', 'email' => 'bot2@example.com'], $captcha)
            ->assertStatus(422)
            ->assertJsonValidationErrors('captcha_answer');

        $this->assertDatabaseCount('users', 1);
    }

    public function test_a_failed_registration_uses_up_the_captcha(): void
    {
        $captcha = $this->solvedCaptcha();

        // Rejected for the password, after the CAPTCHA passed
        $this->register(['password_confirmation' => 'something else'], $captcha)
            ->assertStatus(422)
            ->assertJsonValidationErrors('password');

        $this->register([], $captcha)
            ->assertStatus(422)
            ->assertJsonValidationErrors('captcha_answer');
    }

    public function test_checks_the_captcha_before_revealing_that_an_address_is_taken(): void
    {
        User::factory()->create(['email' => 'jane@example.com']);
        $captcha = $this->solvedCaptcha();
        $captcha['captcha_answer'] = 'wrong';

        $this->register([], $captcha)
            ->assertStatus(422)
            ->assertJsonValidationErrors('captcha_answer')
            ->assertJsonMissingValidationErrors(['email', 'username']);
    }

    public function test_still_validates_the_other_fields(): void
    {
        User::factory()->create(['email' => 'jane@example.com']);

        $this->register()
            ->assertStatus(422)
            ->assertJsonValidationErrors(['email' => 'already been taken']);
    }

    public function test_cannot_register_as_an_admin(): void
    {
        $this->register(['role' => 'admin'])->assertCreated();

        $this->assertSame('user', User::sole()->role);
    }

    public function test_is_rate_limited(): void
    {
        for ($i = 0; $i < 5; $i++) {
            $this->register(['username' => "user_{$i}", 'email' => "user{$i}@example.com"]);
        }

        $this->register(['username' => 'user_6', 'email' => 'user6@example.com'])->assertStatus(429);
    }

    // E-mail verification turned off (the default while there is no mail domain)

    public function test_sends_no_verification_e_mail_while_verification_is_off(): void
    {
        config(['verification.enabled' => false]);

        $this->register()->assertCreated();

        Notification::assertNothingSent();
    }

    public function test_the_new_account_needs_no_verification_while_verification_is_off(): void
    {
        config(['verification.enabled' => false]);

        $this->register()
            ->assertCreated()
            ->assertJsonPath('data.must_verify_email', false)
            // Not marked as verified: turning verification on later still asks
            ->assertJsonPath('data.email_verified_at', null);
    }

    public function test_the_new_account_can_sign_in_right_away(): void
    {
        config(['verification.enabled' => false]);

        $this->register()->assertCreated();

        $this->postJson('/api/v1/login', ['email' => 'jane@example.com', 'password' => self::PASSWORD])
            ->assertOk()
            ->assertJsonPath('user.must_verify_email', false);
    }

    // E-mail verification turned on again

    public function test_sends_the_verification_e_mail_while_verification_is_on(): void
    {
        config(['verification.enabled' => true]);

        $this->register()->assertCreated()->assertJsonPath('data.must_verify_email', true);

        Notification::assertSentTo(User::sole(), VerifyEmailNotification::class);
    }
}
