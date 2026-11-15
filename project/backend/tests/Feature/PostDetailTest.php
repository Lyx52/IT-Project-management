<?php

namespace Tests\Feature;

use App\Enums\PostStatus;
use App\Models\Post;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class PostDetailTest extends TestCase
{
    use RefreshDatabase;

    private function makePost(PostStatus $status, ?User $owner = null): Post
    {
        return Post::factory()->create([
            'user_id' => ($owner ?? User::factory()->create())->id,
            'status' => $status->value,
        ]);
    }

    public function test_guest_sees_everything_about_an_approved_post(): void
    {
        $post = $this->makePost(PostStatus::Approved);
        $post->images()->create(['path' => 'posts/'.$post->id.'/a.jpg']);
        $post->images()->create(['path' => 'posts/'.$post->id.'/b.jpg']);

        $this->getJson("/api/v1/post/{$post->id}")
            ->assertOk()
            ->assertJsonPath('data.id', $post->id)
            ->assertJsonCount(2, 'data.images')
            ->assertJsonStructure([
                'data' => [
                    'id', 'title', 'description', 'location_name', 'event_date',
                    'images' => [['id', 'url']],
                    'category' => ['id', 'name'],
                ],
            ]);
    }

    public function test_guest_can_open_a_resolved_post(): void
    {
        $post = $this->makePost(PostStatus::Resolved);

        $this->getJson("/api/v1/post/{$post->id}")->assertOk();
    }

    public function test_guest_cannot_open_a_pending_post(): void
    {
        $post = $this->makePost(PostStatus::Pending);

        $this->getJson("/api/v1/post/{$post->id}")->assertNotFound();
    }

    public function test_guest_cannot_open_a_rejected_post(): void
    {
        $post = $this->makePost(PostStatus::Rejected);

        $this->getJson("/api/v1/post/{$post->id}")->assertNotFound();
    }

    public function test_another_user_cannot_open_a_pending_or_rejected_post(): void
    {
        $stranger = User::factory()->create();
        $pending = $this->makePost(PostStatus::Pending);
        $rejected = $this->makePost(PostStatus::Rejected);

        $this->actingAs($stranger, 'sanctum');

        $this->getJson("/api/v1/post/{$pending->id}")->assertNotFound();
        $this->getJson("/api/v1/post/{$rejected->id}")->assertNotFound();
    }

    public function test_author_and_admin_can_open_a_pending_post(): void
    {
        $author = User::factory()->create();
        $admin = User::factory()->admin()->create();
        $post = $this->makePost(PostStatus::Pending, $author);

        $this->actingAs($author, 'sanctum')
            ->getJson("/api/v1/post/{$post->id}")
            ->assertOk();

        $this->actingAs($admin, 'sanctum')
            ->getJson("/api/v1/post/{$post->id}")
            ->assertOk();
    }
}
