<?php

namespace Tests\Feature;

use App\Models\User;
use App\Notifications\VerifyEmailNotification;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Notification;
use Illuminate\Testing\TestResponse;
use PHPUnit\Framework\Attributes\TestWith;
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
     * @param  array<string, mixed>|null  $captcha
     *                                              null solves a fresh challenge
     */
    private function register(
        array $overrides = [],
        ?array $captcha = null
    ): TestResponse {
        $captcha ??= $this->solvedCaptcha();

        return $this->postJson(
            '/api/v1/register',
            array_merge([
                'username' => 'jane_doe',
                'email' => 'jane@example.com',
                'password' => self::PASSWORD,
                'password_confirmation' => self::PASSWORD,
                'terms_accepted' => true,
                'privacy_policy_version' => '1.0',
                'captcha_id' => $captcha['captcha_id'],
                'captcha_answer' => $captcha['captcha_answer'],
            ], $overrides)
        );
    }

    // TEST 1: Successful registration
    public function test_creates_an_account_with_a_solved_captcha(): void
    {
        $this->register()
            ->assertCreated()
            ->assertJsonPath('data.username', 'jane_doe')
            ->assertJsonPath('data.email', 'jane@example.com');

        $this->assertDatabaseHas('users', [
            'email' => 'jane@example.com',
        ]);
    }

    // TEST 2: No access token returned
    public function test_never_returns_a_token(): void
    {
        $this->register()
            ->assertCreated()
            ->assertJsonMissingPath('access_token');
    }

    // TEST 3: Different CAPTCHA types
    #[TestWith(['math'])]
    #[TestWith(['determinant'])]
    #[TestWith(['hash'])]
    public function test_creates_an_account_with_each_captcha_type(
        string $type
    ): void {
        config(['captcha.type' => $type]);

        $this->register()->assertCreated();

        $this->assertDatabaseHas('users', [
            'email' => 'jane@example.com',
        ]);
    }

    // TEST 4: Wrong CAPTCHA answer
    #[TestWith(['math', 'That answer is not correct'])]
    #[TestWith(['determinant', 'That answer is not correct'])]
    #[TestWith(['hash', 'The security check failed'])]
    public function test_refuses_a_wrong_answer_and_creates_no_account(
        string $type,
        string $message
    ): void {
        config(['captcha.type' => $type]);

        $captcha = $this->solvedCaptcha();

        $captcha['captcha_answer'] =
            (string) ((int) $captcha['captcha_answer'] + 1);

        $this->register([], $captcha)
            ->assertStatus(422)
            ->assertJsonValidationErrors([
                'captcha_answer' => $message,
            ]);

        $this->assertDatabaseCount('users', 0);
    }

    // TEST 5: Missing CAPTCHA
    public function test_refuses_a_missing_captcha(): void
    {
        $this->register([], [
            'captcha_id' => null,
            'captcha_answer' => null,
        ])
            ->assertStatus(422)
            ->assertJsonValidationErrors('captcha_answer');

        $this->assertDatabaseCount('users', 0);
    }

    // TEST 6: Expired CAPTCHA
    public function test_refuses_an_expired_captcha(): void
    {
        $captcha = $this->solvedCaptcha();

        $this->travel(
            config('captcha.ttl_seconds') + 1
        )->seconds();

        $this->register([], $captcha)
            ->assertStatus(422)
            ->assertJsonValidationErrors([
                'captcha_answer' => 'expired',
            ]);
    }

    // TEST 7: Prevent CAPTCHA reuse
    public function test_a_solved_captcha_cannot_create_a_second_account(): void
    {
        $captcha = $this->solvedCaptcha();

        $this->register([], $captcha)
            ->assertCreated();

        $this->register([
            'username' => 'bot_2',
            'email' => 'bot2@example.com',
        ], $captcha)
            ->assertStatus(422)
            ->assertJsonValidationErrors('captcha_answer');

        $this->assertDatabaseCount('users', 1);
    }

    // TEST 8: Failed registration consumes CAPTCHA
    public function test_a_failed_registration_uses_up_the_captcha(): void
    {
        $captcha = $this->solvedCaptcha();

        $this->register([
            'password_confirmation' => 'something else',
        ], $captcha)
            ->assertStatus(422)
            ->assertJsonValidationErrors('password');

        $this->register([], $captcha)
            ->assertStatus(422)
            ->assertJsonValidationErrors('captcha_answer');
    }

    // TEST 9: CAPTCHA validation before duplicate email
    public function test_checks_the_captcha_before_revealing_that_an_address_is_taken(): void
    {
        User::factory()->create([
            'email' => 'jane@example.com',
        ]);

        $captcha = $this->solvedCaptcha();
        $captcha['captcha_answer'] = 'wrong';

        $this->register([], $captcha)
            ->assertStatus(422)
            ->assertJsonValidationErrors('captcha_answer')
            ->assertJsonMissingValidationErrors([
                'email',
                'username',
            ]);
    }

    // TEST 10: Duplicate email
    public function test_still_validates_the_other_fields(): void
    {
        User::factory()->create([
            'email' => 'jane@example.com',
        ]);

        $this->register()
            ->assertStatus(422)
            ->assertJsonValidationErrors([
                'email' => 'already been taken',
            ]);
    }

    // TEST 11: Prevent admin registration
    public function test_cannot_register_as_an_admin(): void
    {
        $this->register([
            'role' => 'admin',
        ])->assertCreated();

        $this->assertSame(
            'user',
            User::sole()->role
        );
    }

    // TEST 12: Registration rate limiting
    public function test_is_rate_limited(): void
    {
        for ($i = 0; $i < 5; $i++) {
            $this->register([
                'username' => "user_{$i}",
                'email' => "user{$i}@example.com",
            ]);
        }

        $this->register([
            'username' => 'user_6',
            'email' => 'user6@example.com',
        ])->assertStatus(429);
    }

    // TEST 13: Email verification disabled
    public function test_sends_no_verification_e_mail_while_verification_is_off(): void
    {
        config(['verification.enabled' => false]);

        $this->register()->assertCreated();

        Notification::assertNothingSent();
    }

    // TEST 14: No email verification required
    public function test_the_new_account_needs_no_verification_while_verification_is_off(): void
    {
        config(['verification.enabled' => false]);

        $this->register()
            ->assertCreated()
            ->assertJsonPath(
                'data.must_verify_email',
                false
            )
            ->assertJsonPath(
                'data.email_verified_at',
                null
            );
    }

    // TEST 15: Login after registration
    public function test_the_new_account_can_sign_in_right_away(): void
    {
        config(['verification.enabled' => false]);

        $this->register()->assertCreated();

        $this->postJson('/api/v1/login', [
            'email' => 'jane@example.com',
            'password' => self::PASSWORD,
        ])
            ->assertOk()
            ->assertJsonPath(
                'user.must_verify_email',
                false
            );
    }

    // TEST 16: Email verification enabled
    public function test_sends_the_verification_e_mail_while_verification_is_on(): void
    {
        config(['verification.enabled' => true]);

        $this->register()
            ->assertCreated()
            ->assertJsonPath(
                'data.must_verify_email',
                true
            );

        Notification::assertSentTo(
            User::sole(),
            VerifyEmailNotification::class
        );
    }

    // NEW TEST 17: Verify password hashing and saved fields
    public function test_registration_stores_security_fields(): void
    {
        $response = $this->register();

        $response->assertCreated()
            ->assertJsonMissingPath('data.password');

        $this->assertStringNotContainsString(
            self::PASSWORD,
            (string) $response->getContent()
        );

        $user = User::where(
            'email',
            'jane@example.com'
        )->firstOrFail();

        $this->assertTrue(
            Hash::check(
                self::PASSWORD,
                $user->password
            )
        );

        $this->assertNotNull(
            $user->terms_accepted_at
        );

        $this->assertSame(
            '1.0',
            $user->privacy_policy_version
        );
    }

    // NEW TEST 18: Reject duplicate username
    public function test_rejects_duplicate_username(): void
    {
        User::factory()->create([
            'username' => 'jane_doe',
            'email' => 'existing@example.com',
        ]);

        $this->register()
            ->assertStatus(422)
            ->assertJsonValidationErrors('username');

        $this->assertDatabaseCount('users', 1);
    }

    // NEW TEST 19: Reject missing required fields
    public function test_rejects_missing_required_fields(): void
    {
        $this->register([
            'username' => null,
            'email' => null,
            'password' => null,
            'password_confirmation' => null,
        ])
            ->assertStatus(422)
            ->assertJsonValidationErrors([
                'username',
                'email',
                'password',
            ]);

        $this->assertDatabaseCount('users', 0);
    }

    // NEW TEST 20: Reject short passwords
    public function test_rejects_short_password(): void
    {
        $this->register([
            'password' => 'short',
            'password_confirmation' => 'short',
        ])
            ->assertStatus(422)
            ->assertJsonValidationErrors('password');

        $this->assertDatabaseCount('users', 0);
    }

    // NEW TEST 21: Reject unaccepted terms
    public function test_rejects_unaccepted_terms(): void
    {
        $this->register([
            'terms_accepted' => false,
        ])
            ->assertStatus(422)
            ->assertJsonValidationErrors(
                'terms_accepted'
            );

        $this->assertDatabaseCount('users', 0);
    }
}
