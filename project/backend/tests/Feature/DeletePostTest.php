<?php

namespace Tests\Feature;

use App\Models\Post;
use App\Models\User;
use App\Services\PostImageService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Storage;
use Tests\TestCase;

class DeletePostTest extends TestCase
{
    use RefreshDatabase;

    /**
     * A post with two stored image files and their database rows.
     *
     * @return array{0: Post, 1: array<int, string>}
     */
    private function postWithImages(User $owner): array
    {
        Storage::fake('public');

        $post = Post::factory()->create(['user_id' => $owner->id]);
        $paths = [];

        foreach (['one.jpg', 'two.jpg'] as $name) {
            $path = PostImageService::directory($post).'/'.$name;
            Storage::disk('public')->put($path, 'image-content');
            $post->images()->create(['path' => $path]);
            $paths[] = $path;
        }

        return [$post, $paths];
    }

    public function test_admin_can_delete_someone_elses_post_and_its_images(): void
    {
        $owner = User::factory()->create();
        $admin = User::factory()->admin()->create();
        [$post, $paths] = $this->postWithImages($owner);

        $this->actingAs($admin, 'sanctum')
            ->deleteJson("/api/v1/post/{$post->id}")
            ->assertNoContent();

        $this->assertDatabaseMissing('posts', ['id' => $post->id]);
        $this->assertDatabaseMissing('post_images', ['post_id' => $post->id]);

        foreach ($paths as $path) {
            Storage::disk('public')->assertMissing($path);
        }
    }

    public function test_another_user_cannot_delete_the_post(): void
    {
        $owner = User::factory()->create();
        $stranger = User::factory()->create();
        [$post, $paths] = $this->postWithImages($owner);

        $this->actingAs($stranger, 'sanctum')
            ->deleteJson("/api/v1/post/{$post->id}")
            ->assertForbidden();

        $this->assertDatabaseHas('posts', ['id' => $post->id]);

        foreach ($paths as $path) {
            Storage::disk('public')->assertExists($path);
        }
    }

    public function test_guest_cannot_delete_a_post(): void
    {
        $owner = User::factory()->create();
        [$post, $paths] = $this->postWithImages($owner);

        $this->deleteJson("/api/v1/post/{$post->id}")
            ->assertUnauthorized();

        $this->assertDatabaseHas('posts', ['id' => $post->id]);

        foreach ($paths as $path) {
            Storage::disk('public')->assertExists($path);
        }
    }

    public function test_deleting_a_missing_post_returns_not_found(): void
    {
        $user = User::factory()->create();

        $this->actingAs($user, 'sanctum')
            ->deleteJson('/api/v1/post/999999')
            ->assertNotFound();
    }
}
