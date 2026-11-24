<?php

namespace Tests\Feature;

use App\Models\User;
use App\Notifications\ResetPasswordNotification;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Notification;
use Illuminate\Support\Facades\Password;
use Tests\TestCase;

class PasswordResetTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();

        Notification::fake();
    }

    public function test_reset_request_sends_a_link_and_stores_only_a_hashed_token(): void
    {
        $user = User::factory()->create(['email' => 'jane@example.com']);

        $this->postJson('/api/v1/forgot-password', ['email' => 'JANE@example.com'])
            ->assertOk()
            ->assertJsonPath('message', 'If an account exists for that e-mail address, password reset instructions have been sent.');

        Notification::assertSentTo($user, ResetPasswordNotification::class, function (ResetPasswordNotification $notification) use ($user): bool {
            $storedToken = DB::table('password_reset_tokens')->where('email', $user->email)->value('token');

            $this->assertIsString($storedToken);
            $this->assertNotSame($notification->token, $storedToken);
            $this->assertTrue(Hash::check($notification->token, $storedToken));
            $this->assertSame(60, config('auth.passwords.'.config('auth.defaults.passwords').'.expire'));

            $message = $notification->toMail($user);
            $this->assertSame('emails.reset-password', $message->view);
            $this->assertSame($notification->token, $this->queryParameter($message->viewData['url'], 'token'));
            $this->assertSame($user->email, $this->queryParameter($message->viewData['url'], 'email'));

            return true;
        });
    }

    public function test_reset_request_does_not_disclose_unknown_addresses(): void
    {
        $response = $this->postJson('/api/v1/forgot-password', ['email' => 'missing@example.com']);

        $response->assertOk()
            ->assertJsonPath('message', 'If an account exists for that e-mail address, password reset instructions have been sent.');

        Notification::assertNothingSent();
    }

    public function test_reset_link_expires_after_sixty_minutes(): void
    {
        $user = User::factory()->create();
        $token = Password::createToken($user);

        $this->travel(61)->minutes();

        $this->postJson('/api/v1/reset-password', [
            'email' => $user->email,
            'token' => $token,
            'password' => 'new correct horse',
            'password_confirmation' => 'new correct horse',
        ])->assertUnprocessable();

        $this->assertFalse(Hash::check('new correct horse', $user->fresh()->password));
    }

    public function test_reset_changes_the_password_and_revokes_existing_tokens(): void
    {
        $user = User::factory()->create(['password' => 'old correct horse']);
        $user->createToken('old-session');
        $token = Password::createToken($user);

        $this->postJson('/api/v1/reset-password', [
            'email' => $user->email,
            'token' => $token,
            'password' => 'new correct horse',
            'password_confirmation' => 'new correct horse',
        ])->assertOk();

        $this->assertTrue(Hash::check('new correct horse', $user->fresh()->password));
        $this->assertFalse(Hash::check('old correct horse', $user->fresh()->password));
        $this->assertDatabaseMissing('personal_access_tokens', ['tokenable_id' => $user->id]);

        $this->postJson('/api/v1/login', [
            'email' => $user->email,
            'password' => 'old correct horse',
        ])->assertUnprocessable();

        $this->postJson('/api/v1/login', [
            'email' => $user->email,
            'password' => 'new correct horse',
        ])->assertOk();
    }

    public function test_reset_rejects_a_wrong_token_and_mismatched_passwords(): void
    {
        $user = User::factory()->create(['password' => 'old correct horse']);
        $token = Password::createToken($user);

        $this->postJson('/api/v1/reset-password', [
            'email' => $user->email,
            'token' => 'not-the-token',
            'password' => 'new correct horse',
            'password_confirmation' => 'new correct horse',
        ])->assertUnprocessable();

        $this->postJson('/api/v1/reset-password', [
            'email' => $user->email,
            'token' => $token,
            'password' => 'new correct horse',
            'password_confirmation' => 'different password',
        ])->assertUnprocessable();

        $this->assertTrue(Hash::check('old correct horse', $user->fresh()->password));
    }

    private function queryParameter(string $url, string $name): ?string
    {
        parse_str((string) parse_url($url, PHP_URL_QUERY), $query);

        return $query[$name] ?? null;
    }
}
