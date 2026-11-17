<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Testing\TestResponse;
use Tests\TestCase;

class LoginTest extends TestCase
{
    use RefreshDatabase;

    private const PASSWORD = 'password';

    private function login(array $overrides = []): TestResponse
    {
        return $this->postJson('/api/v1/login', array_merge([
            'email' => 'jane@example.com',
            'password' => self::PASSWORD,
        ], $overrides));
    }

    public function test_returns_a_token_and_the_user(): void
    {
        $user = User::factory()->create(['email' => 'jane@example.com', 'username' => 'jane']);

        $response = $this->login();

        $response->assertOk()
            ->assertJsonPath('token_type', 'Bearer')
            ->assertJsonPath('user.id', $user->id)
            ->assertJsonPath('user.username', 'jane')
            ->assertJsonPath('user.email', 'jane@example.com');

        $this->assertNotEmpty($response->json('access_token'));
    }

    public function test_the_user_is_not_wrapped_in_data(): void
    {
        User::factory()->create(['email' => 'jane@example.com']);

        // Nested resources are not wrapped; GET /user returns one directly and is.
        $this->login()->assertJsonMissingPath('user.data');
    }

    public function test_never_exposes_the_password(): void
    {
        User::factory()->create(['email' => 'jane@example.com']);

        $body = $this->login()->assertOk()->json();

        $this->assertArrayNotHasKey('password', $body['user']);
        $this->assertStringNotContainsString('$2y$', json_encode($body));
    }

    public function test_refuses_a_wrong_password(): void
    {
        User::factory()->create(['email' => 'jane@example.com']);

        $this->login(['password' => 'not-the-password'])
            ->assertStatus(422)
            ->assertJsonValidationErrors('email');
    }

    public function test_refuses_an_unknown_address(): void
    {
        $this->login(['email' => 'nobody@example.com'])
            ->assertStatus(422)
            ->assertJsonValidationErrors('email');
    }

    public function test_matches_the_address_case_insensitively(): void
    {
        User::factory()->create(['email' => 'jane@example.com']);

        $this->login(['email' => 'JANE@Example.COM'])->assertOk();
    }

    public function test_refuses_a_banned_account(): void
    {
        $user = User::factory()->create(['email' => 'jane@example.com']);
        $user->forceFill(['banned_at' => now()])->save();

        $this->login()
            ->assertStatus(403)
            ->assertJsonPath('message', 'This account has been banned.');
    }

    public function test_issues_no_token_to_a_banned_account(): void
    {
        $user = User::factory()->create(['email' => 'jane@example.com']);
        $user->forceFill(['banned_at' => now()])->save();

        $this->login()->assertStatus(403);

        $this->assertSame(0, $user->tokens()->count());
    }

    public function test_does_not_reveal_a_ban_to_someone_without_the_password(): void
    {
        $user = User::factory()->create(['email' => 'jane@example.com']);
        $user->forceFill(['banned_at' => now()])->save();

        // 422 like any other bad credentials, so the endpoint cannot be used to
        // find out which addresses belong to banned accounts.
        $this->login(['password' => 'not-the-password'])->assertStatus(422);
    }

    public function test_lets_an_unverified_account_sign_in(): void
    {
        // Verification gates posting, not signing in. It has to: the resend
        // endpoint needs a token, so a verification-gated login would leave a
        // user whose link expired with no way to get a new one.
        User::factory()->unverified()->create(['email' => 'jane@example.com']);

        $this->login()
            ->assertOk()
            ->assertJsonPath('user.email_verified_at', null);
    }

    public function test_names_the_token_from_device_name(): void
    {
        $user = User::factory()->create(['email' => 'jane@example.com']);

        $this->login(['device_name' => 'web'])->assertOk();

        $this->assertSame('web', $user->tokens()->sole()->name);
    }

    public function test_requires_an_email_and_password(): void
    {
        $this->postJson('/api/v1/login', [])
            ->assertStatus(422)
            ->assertJsonValidationErrors(['email', 'password']);
    }
}
