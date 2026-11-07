<?php

namespace Tests\Feature;

use App\Console\Commands\CreateAdminCommand;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Tests\TestCase;

class CreateAdminCommandTest extends TestCase
{
    use RefreshDatabase;

    private const ARGS = ['--username' => 'boss', '--email' => 'boss@example.com'];

    private const PASSWORD = 'correct-horse-battery';

    protected function setUp(): void
    {
        parent::setUp();

        // Test runs have no TTY, so pretend there is one by default
        $this->fakeTerminal(true);
    }

    private function fakeTerminal(bool $present): void
    {
        $this->app->bind(CreateAdminCommand::class, fn () => $present
            ? new class extends CreateAdminCommand
            {
                protected function hasTerminal(): bool
                {
                    return true;
                }
            }
            : new class extends CreateAdminCommand
            {
                protected function hasTerminal(): bool
                {
                    return false;
                }
            });
    }

    public function test_creates_admin_with_prompted_password(): void
    {
        $this->artisan('app:create-admin', self::ARGS)
            ->expectsQuestion('Password (min. 12 characters)', self::PASSWORD)
            ->expectsQuestion('Repeat password', self::PASSWORD)
            ->assertSuccessful();

        $user = User::where('username', 'boss')->firstOrFail();
        $this->assertSame('admin', $user->role);
        $this->assertSame('boss@example.com', $user->email);
        $this->assertTrue(Hash::check(self::PASSWORD, $user->password));
        $this->assertNotNull($user->email_verified_at);
        $this->assertNotNull($user->terms_accepted_at);
    }

    public function test_refuses_to_run_without_interactive_terminal(): void
    {
        $this->artisan('app:create-admin', self::ARGS + ['--no-interaction' => true])
            ->expectsOutputToContain('interactive terminal')
            ->assertFailed();

        $this->assertSame(0, User::count());
    }

    public function test_refuses_piped_input_without_a_real_terminal(): void
    {
        $this->fakeTerminal(false);

        $this->artisan('app:create-admin', self::ARGS)
            ->expectsOutputToContain('interactive terminal')
            ->assertFailed();

        $this->assertSame(0, User::count());
    }

    public function test_rejects_mismatched_passwords(): void
    {
        $this->artisan('app:create-admin', self::ARGS)
            ->expectsQuestion('Password (min. 12 characters)', self::PASSWORD)
            ->expectsQuestion('Repeat password', 'something-else-entirely')
            ->assertFailed();

        $this->assertDatabaseMissing('users', ['username' => 'boss']);
    }

    public function test_rejects_short_password(): void
    {
        $this->artisan('app:create-admin', self::ARGS)
            ->expectsQuestion('Password (min. 12 characters)', 'short')
            ->expectsQuestion('Repeat password', 'short')
            ->assertFailed();

        $this->assertDatabaseMissing('users', ['username' => 'boss']);
    }

    public function test_refuses_when_an_admin_already_exists(): void
    {
        User::factory()->admin()->create();

        $this->artisan('app:create-admin', self::ARGS)
            ->expectsOutputToContain('already exists')
            ->assertFailed();

        $this->assertDatabaseMissing('users', ['username' => 'boss']);
    }

    public function test_runs_again_when_the_only_admin_is_banned(): void
    {
        User::factory()->admin()->create(['banned_at' => now()]);

        $this->artisan('app:create-admin', self::ARGS)
            ->expectsQuestion('Password (min. 12 characters)', self::PASSWORD)
            ->expectsQuestion('Repeat password', self::PASSWORD)
            ->assertSuccessful();

        $this->assertSame('admin', User::where('username', 'boss')->value('role'));
    }

    public function test_refuses_taken_email_case_insensitively(): void
    {
        User::factory()->create(['username' => 'someone', 'email' => 'Boss@Example.com']);

        $this->artisan('app:create-admin', self::ARGS)->assertFailed();

        $this->assertSame(1, User::count());
        $this->assertSame('user', User::first()->role);
    }

    public function test_refuses_taken_username(): void
    {
        User::factory()->create(['username' => 'boss', 'email' => 'other@example.com']);

        $this->artisan('app:create-admin', self::ARGS)->assertFailed();

        $this->assertSame(0, User::where('role', 'admin')->count());
    }

    /**
     * Guards against a future signup/profile endpoint letting a web request
     * make itself admin with {"role": "admin"} (mass assignment).
     */
    public function test_role_cannot_be_mass_assigned(): void
    {
        $user = (new User)->fill(['role' => 'admin']);

        $this->assertNotSame('admin', $user->role);
    }
}
