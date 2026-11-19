<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class AdminUserListTest extends TestCase
{
    use RefreshDatabase;

    private function actingAsAdmin(): User
    {
        $admin = User::factory()->admin()->create(['username' => 'boss']);
        Sanctum::actingAs($admin);

        return $admin;
    }

    public function test_lists_users_with_their_moderation_state(): void
    {
        $this->actingAsAdmin();
        User::factory()->create(['username' => 'alice', 'email' => 'alice@example.com']);

        $response = $this->getJson('/api/v1/admin/users')->assertOk();

        $alice = collect($response->json('data'))->firstWhere('username', 'alice');

        $this->assertNotNull($alice);
        $this->assertSame('alice@example.com', $alice['email']);
        $this->assertSame('user', $alice['role']);
        $this->assertNull($alice['banned_at']);
        $this->assertSame(0, $alice['posts_count']);
    }

    public function test_is_paginated(): void
    {
        $this->actingAsAdmin();

        $this->getJson('/api/v1/admin/users')
            ->assertOk()
            ->assertJsonStructure(['data', 'links', 'meta']);
    }

    public function test_never_exposes_password_hashes(): void
    {
        $this->actingAsAdmin();
        User::factory()->create();

        $body = $this->getJson('/api/v1/admin/users')->assertOk()->json();

        $this->assertStringNotContainsString('$2y$', json_encode($body));
    }

    public function test_searches_by_username_regardless_of_case(): void
    {
        $this->actingAsAdmin();
        User::factory()->create(['username' => 'Zebra']);
        User::factory()->create(['username' => 'walrus']);

        $usernames = collect($this->getJson('/api/v1/admin/users?search=zeb')->assertOk()->json('data'))
            ->pluck('username');

        $this->assertTrue($usernames->contains('Zebra'));
        $this->assertFalse($usernames->contains('walrus'));
    }

    public function test_searches_by_email(): void
    {
        $this->actingAsAdmin();
        User::factory()->create(['username' => 'needle', 'email' => 'findme@example.com']);

        $usernames = collect($this->getJson('/api/v1/admin/users?search=findme')->assertOk()->json('data'))
            ->pluck('username');

        $this->assertTrue($usernames->contains('needle'));
    }

    public function test_filters_to_banned_accounts(): void
    {
        $this->actingAsAdmin();
        $banned = User::factory()->create(['username' => 'troll']);
        $banned->forceFill(['banned_at' => now()])->save();
        User::factory()->create(['username' => 'innocent']);

        $usernames = collect($this->getJson('/api/v1/admin/users?status=banned')->assertOk()->json('data'))
            ->pluck('username');

        $this->assertTrue($usernames->contains('troll'));
        $this->assertFalse($usernames->contains('innocent'));
    }

    public function test_filters_to_active_accounts(): void
    {
        $this->actingAsAdmin();
        $banned = User::factory()->create(['username' => 'troll']);
        $banned->forceFill(['banned_at' => now()])->save();

        $usernames = collect($this->getJson('/api/v1/admin/users?status=active')->assertOk()->json('data'))
            ->pluck('username');

        $this->assertFalse($usernames->contains('troll'));
    }

    public function test_rejects_an_unknown_status_filter(): void
    {
        $this->actingAsAdmin();

        $this->getJson('/api/v1/admin/users?status=nonsense')
            ->assertStatus(422)
            ->assertJsonValidationErrors('status');
    }

    public function test_is_closed_to_ordinary_users(): void
    {
        Sanctum::actingAs(User::factory()->create());

        $this->getJson('/api/v1/admin/users')->assertStatus(403);
    }

    public function test_is_closed_to_visitors(): void
    {
        $this->getJson('/api/v1/admin/users')->assertStatus(401);
    }
}
