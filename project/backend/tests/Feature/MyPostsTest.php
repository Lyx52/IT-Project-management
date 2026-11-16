<?php

namespace Tests\Feature;

use App\Models\Post;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class MyPostsTest extends TestCase
{
    use RefreshDatabase;

    public function test_guests_have_no_posts_of_their_own(): void
    {
        $this->getJson('/api/v1/user/posts')->assertUnauthorized();
    }

    public function test_lists_the_users_posts_in_every_status_newest_first(): void
    {
        $user = User::factory()->create();
        $pending = Post::factory()->create(['user_id' => $user->id]);
        $this->travel(1)->minutes();
        $approved = Post::factory()->approved()->create(['user_id' => $user->id]);
        $this->travel(1)->minutes();
        $rejected = Post::factory()->rejected()->create(['user_id' => $user->id]);
        $this->travel(1)->minutes();
        $resolved = Post::factory()->resolved()->create(['user_id' => $user->id]);
        Post::factory()->approved()->create();
        Sanctum::actingAs($user);

        $response = $this->getJson('/api/v1/user/posts')->assertOk();

        $this->assertSame(
            [$resolved->id, $rejected->id, $approved->id, $pending->id],
            collect($response->json('data'))->pluck('id')->all(),
        );
        $this->assertSame(
            ['resolved', 'rejected', 'approved', 'pending'],
            collect($response->json('data'))->pluck('status')->all(),
        );
        $response->assertJsonPath('data.0.category.id', $resolved->category_id)
            ->assertJsonPath('data.0.user.id', $user->id)
            ->assertJsonPath('meta.total', 4);
    }

    public function test_is_paginated(): void
    {
        $user = User::factory()->create();
        Post::factory()->count(21)->create(['user_id' => $user->id]);
        Sanctum::actingAs($user);

        $this->getJson('/api/v1/user/posts')->assertJsonCount(20, 'data')->assertJsonPath('meta.last_page', 2);
        $this->getJson('/api/v1/user/posts?page=2')->assertJsonCount(1, 'data');
    }
}
