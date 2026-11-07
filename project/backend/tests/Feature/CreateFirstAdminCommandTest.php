<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Tests\TestCase;

class CreateFirstAdminCommandTest extends TestCase
{
    use RefreshDatabase;

    private const ARGS = ['--username' => 'boss', '--email' => 'boss@example.com'];

    public function test_creates_admin_with_prompted_password(): void
    {
        $this->artisan('app:create-first-admin', self::ARGS)
            ->expectsQuestion('Password (min. 12 characters)', 'correct-horse-battery')
            ->expectsQuestion('Repeat password', 'correct-horse-battery')
            ->assertSuccessful();

        $user = User::where('username', 'boss')->firstOrFail();
        $this->assertSame('admin', $user->role);
        $this->assertSame('boss@example.com', $user->email);
        $this->assertTrue(Hash::check('correct-horse-battery', $user->password));
        $this->assertNotNull($user->email_verified_at);
        $this->assertNotNull($user->terms_accepted_at);
    }

    public function test_generates_password_when_not_interactive(): void
    {
        $this->artisan('app:create-first-admin', self::ARGS + ['--no-interaction' => true])
            ->expectsOutputToContain('Generated password')
            ->assertSuccessful();

        $this->assertSame('admin', User::where('username', 'boss')->value('role'));
    }

    public function test_rejects_mismatched_passwords(): void
    {
        $this->artisan('app:create-first-admin', self::ARGS)
            ->expectsQuestion('Password (min. 12 characters)', 'correct-horse-battery')
            ->expectsQuestion('Repeat password', 'something-else-entirely')
            ->assertFailed();

        $this->assertDatabaseMissing('users', ['username' => 'boss']);
    }

    public function test_rejects_short_password(): void
    {
        $this->artisan('app:create-first-admin', self::ARGS)
            ->expectsQuestion('Password (min. 12 characters)', 'short')
            ->expectsQuestion('Repeat password', 'short')
            ->assertFailed();

        $this->assertDatabaseMissing('users', ['username' => 'boss']);
    }

    public function test_refuses_when_an_admin_already_exists(): void
    {
        User::factory()->admin()->create();

        $this->artisan('app:create-first-admin', self::ARGS + ['--no-interaction' => true])
            ->expectsOutputToContain('already exists')
            ->assertFailed();

        $this->assertDatabaseMissing('users', ['username' => 'boss']);
    }

    public function test_runs_again_when_the_only_admin_is_banned(): void
    {
        User::factory()->admin()->create(['banned_at' => now()]);

        $this->artisan('app:create-first-admin', self::ARGS + ['--no-interaction' => true])
            ->assertSuccessful();

        $this->assertSame('admin', User::where('username', 'boss')->value('role'));
    }

    public function test_refuses_taken_email_case_insensitively(): void
    {
        User::factory()->create(['username' => 'someone', 'email' => 'Boss@Example.com']);

        $this->artisan('app:create-first-admin', self::ARGS + ['--no-interaction' => true])
            ->assertFailed();

        $this->assertSame(1, User::count());
        $this->assertSame('user', User::first()->role);
    }

    public function test_refuses_taken_username(): void
    {
        User::factory()->create(['username' => 'boss', 'email' => 'other@example.com']);

        $this->artisan('app:create-first-admin', self::ARGS + ['--no-interaction' => true])
            ->assertFailed();

        $this->assertSame(0, User::where('role', 'admin')->count());
    }
}
