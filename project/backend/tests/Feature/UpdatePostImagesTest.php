<?php

namespace Tests\Feature;

use App\Models\Post;
use App\Models\PostImage;
use App\Models\User;
use App\Services\PostImageService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class UpdatePostImagesTest extends TestCase
{
    use RefreshDatabase;

    private Post $post;

    protected function setUp(): void
    {
        parent::setUp();
        Storage::fake('public');
        $this->post = Post::factory()->approved()->create();
        Sanctum::actingAs($this->post->user);
    }

    private function addImage(Post $post): PostImage
    {
        $path = PostImageService::directory($post).'/'.uniqid().'.jpg';
        Storage::disk('public')->put($path, 'x');

        return $post->images()->create(['path' => $path]);
    }

    private function update(array $data)
    {
        return $this->post("/api/v1/post/{$this->post->id}", $data, ['Accept' => 'application/json']);
    }

    public function test_adds_a_photo_and_sends_the_post_back_to_moderation(): void
    {
        $this->update(['images' => [UploadedFile::fake()->image('new.jpg', 100, 100)]])
            ->assertOk()
            ->assertJsonPath('data.status', 'pending')
            ->assertJsonCount(1, 'data.images');

        $this->assertCount(1, Storage::disk('public')->allFiles('posts/'.$this->post->id));
    }

    public function test_removes_a_photo_and_deletes_its_file(): void
    {
        $keep = $this->addImage($this->post);
        $drop = $this->addImage($this->post);

        $this->update(['remove_images' => [$drop->id]])
            ->assertOk()
            ->assertJsonPath('data.status', 'pending')
            ->assertJsonCount(1, 'data.images')
            ->assertJsonPath('data.images.0.id', $keep->id);

        Storage::disk('public')->assertMissing($drop->path);
        Storage::disk('public')->assertExists($keep->path);
        $this->assertDatabaseMissing('post_images', ['id' => $drop->id]);
    }

    public function test_cannot_remove_another_posts_photo(): void
    {
        $other = $this->addImage(Post::factory()->approved()->create());

        $this->update(['remove_images' => [$other->id]])->assertUnprocessable();

        $this->assertDatabaseHas('post_images', ['id' => $other->id]);
    }

    public function test_a_post_keeps_at_most_five_photos(): void
    {
        foreach (range(1, 4) as $_) {
            $this->addImage($this->post);
        }

        $this->update(['images' => [
            UploadedFile::fake()->image('a.jpg'),
            UploadedFile::fake()->image('b.jpg'),
        ]])->assertUnprocessable()->assertJsonValidationErrors('images');

        // Removing one makes room
        $drop = $this->post->images()->first();
        $this->update([
            'remove_images' => [$drop->id],
            'images' => [UploadedFile::fake()->image('a.jpg'), UploadedFile::fake()->image('b.jpg')],
        ])->assertOk()->assertJsonCount(5, 'data.images');
    }

    public function test_an_edit_without_changes_keeps_the_post_approved(): void
    {
        $this->update(['title' => $this->post->title])
            ->assertOk()
            ->assertJsonPath('data.status', 'approved');
    }

    public function test_rejects_files_that_are_not_images(): void
    {
        $this->update(['images' => [UploadedFile::fake()->create('a.pdf', 10, 'application/pdf')]])
            ->assertUnprocessable();
    }

    public function test_others_cannot_change_photos(): void
    {
        $image = $this->addImage($this->post);
        Sanctum::actingAs(User::factory()->create());

        $this->update(['remove_images' => [$image->id]])->assertForbidden();

        $this->assertDatabaseHas('post_images', ['id' => $image->id]);
    }
}
