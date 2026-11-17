<?php

namespace Tests\Feature;

use App\Models\Post;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class RejectionReasonTest extends TestCase
{
    use RefreshDatabase;

    public function test_rejecting_stores_the_reason_and_shows_it_to_the_author(): void
    {
        $author = User::factory()->create();
        $post = Post::factory()->create(['user_id' => $author->id]);

        Sanctum::actingAs(User::factory()->admin()->create());
        $this->postJson("/api/v1/admin/posts/{$post->id}/reject", ['reason' => 'Contains a phone number'])
            ->assertOk()
            ->assertJsonPath('data.rejection_reason', 'Contains a phone number');

        Sanctum::actingAs($author);
        $this->getJson('/api/v1/user/posts')
            ->assertOk()
            ->assertJsonPath('data.0.rejection_reason', 'Contains a phone number');
    }

    public function test_other_users_never_see_the_reason(): void
    {
        $post = Post::factory()->rejected()->create(['rejection_reason' => 'Spam']);

        Sanctum::actingAs(User::factory()->create());
        $this->getJson("/api/v1/post/{$post->id}")->assertNotFound();

        Sanctum::actingAs($post->user);
        $this->getJson("/api/v1/post/{$post->id}")->assertJsonPath('data.rejection_reason', 'Spam');
    }

    public function test_editing_a_rejected_post_clears_the_reason(): void
    {
        $post = Post::factory()->rejected()->create(['rejection_reason' => 'Too vague']);
        Sanctum::actingAs($post->user);

        $this->postJson("/api/v1/post/{$post->id}", ['title' => 'A much clearer title'])
            ->assertOk()
            ->assertJsonPath('data.status', 'pending')
            ->assertJsonMissingPath('data.rejection_reason');

        $this->assertNull($post->fresh()->rejection_reason);
    }
}
