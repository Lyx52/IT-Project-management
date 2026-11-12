<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class CurrentUserTest extends TestCase
{
    use RefreshDatabase;

    public function test_returns_the_signed_in_user_wrapped_in_data(): void
    {
        $user = User::factory()->create(['username' => 'jane']);
        Sanctum::actingAs($user);

        $this->getJson('/api/v1/user')
            ->assertOk()
            ->assertJsonPath('data.id', $user->id)
            ->assertJsonPath('data.username', 'jane');
    }

    public function test_reports_whether_the_address_is_verified(): void
    {
        Sanctum::actingAs(User::factory()->unverified()->create());

        $this->getJson('/api/v1/user')
            ->assertOk()
            ->assertJsonPath('data.email_verified_at', null);
    }

    public function test_never_exposes_the_password(): void
    {
        Sanctum::actingAs(User::factory()->create());

        $body = $this->getJson('/api/v1/user')->assertOk()->json('data');

        $this->assertArrayNotHasKey('password', $body);
    }

    public function test_rejects_an_unauthenticated_request(): void
    {
        $this->getJson('/api/v1/user')->assertStatus(401);
    }

    public function test_rejects_a_revoked_token(): void
    {
        $user = User::factory()->create();
        $token = $user->createToken('web')->plainTextToken;

        $user->tokens()->delete();

        $this->withHeader('Authorization', "Bearer {$token}")
            ->getJson('/api/v1/user')
            ->assertStatus(401);
    }
}
