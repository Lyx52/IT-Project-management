<?php

namespace Tests\Feature;

use App\Models\Category;
use App\Models\Post;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Tests\TestCase;

class PostImageTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        Storage::fake('public');
    }

    private function payload(array $images): array
    {
        return [
            'type' => 'lost',
            'category_id' => Category::query()->firstOrCreate(['name' => 'Keys'])->id,
            'title' => 'Lost keys',
            'description' => 'Black keychain',
            'latitude' => 56.95,
            'longitude' => 24.1,
            'event_date' => now()->format('Y-m-d'),
            'images' => $images,
        ];
    }

    private function storePost(array $images)
    {
        $user = User::factory()->create(['email_verified_at' => now()]);

        return $this->actingAs($user, 'sanctum')->post('/api/v1/posts', $this->payload($images), ['Accept' => 'application/json']);
    }

    public function test_stores_images_under_posts_id_with_a_guid_name(): void
    {
        $response = $this->storePost([UploadedFile::fake()->image('my cat.jpg'), UploadedFile::fake()->image('b.png')]);

        $response->assertCreated()->assertJsonCount(2, 'data.images');
        $id = $response->json('data.id');

        $paths = Post::findOrFail($id)->images()->pluck('path');
        $this->assertCount(2, $paths);
        foreach ($paths as $path) {
            $this->assertMatchesRegularExpression('#^posts/'.$id.'/[0-9a-f-]{36}\.(jpg|png)$#', $path);
            Storage::disk('public')->assertExists($path);
        }
    }

    public function test_exif_is_stripped(): void
    {
        $jpeg = tempnam(sys_get_temp_dir(), 'img');
        imagejpeg(imagecreatetruecolor(20, 20), $jpeg);
        // Inject an APP1 "Exif" segment right after the SOI marker
        $data = file_get_contents($jpeg);
        $exif = "Exif\0\0GPSLATITUDE-MARKER";
        file_put_contents($jpeg, substr($data, 0, 2)."\xFF\xE1".pack('n', strlen($exif) + 2).$exif.substr($data, 2));
        $this->assertStringContainsString('GPSLATITUDE-MARKER', file_get_contents($jpeg));

        $response = $this->storePost([new UploadedFile($jpeg, 'x.jpg', 'image/jpeg', null, true)]);

        $response->assertCreated();
        $stored = Storage::disk('public')->get(Post::first()->images()->value('path'));
        $this->assertStringNotContainsString('GPSLATITUDE-MARKER', $stored);
    }

    public function test_rejects_more_than_five_images(): void
    {
        $images = array_map(fn ($i) => UploadedFile::fake()->image("$i.jpg"), range(1, 6));

        $this->storePost($images)->assertUnprocessable()->assertJsonValidationErrors('images');
        $this->assertSame(0, Post::count());
    }

    public function test_rejects_wrong_type_and_oversize(): void
    {
        $this->storePost([UploadedFile::fake()->create('a.pdf', 10, 'application/pdf')])
            ->assertUnprocessable()->assertJsonValidationErrors('images.0');
        $this->storePost([UploadedFile::fake()->image('big.jpg')->size(6000)])
            ->assertUnprocessable()->assertJsonValidationErrors('images.0');
    }

    public function test_deleting_a_post_removes_its_files(): void
    {
        $id = $this->storePost([UploadedFile::fake()->image('a.jpg')])->json('data.id');
        $user = Post::find($id)->user;

        $this->actingAs($user, 'sanctum')->deleteJson("/api/v1/post/$id")->assertNoContent();

        $this->assertSame([], Storage::disk('public')->allFiles("posts/$id"));
        $this->assertDatabaseCount('post_images', 0);
    }
}
