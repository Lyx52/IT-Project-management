<?php

namespace Tests\Feature;

use App\Http\Requests\RegisterRequest;
use App\Models\Category;
use App\Models\Message;
use App\Models\Post;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

/**
 * Hardening that cuts across features: token lifetime, CORS, login throttling,
 * reports on hidden posts, messages to banned authors and oversized images.
 */
class SecurityHardeningTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        Category::firstOrCreate(['name' => 'Keys']);
    }

    // --- API tokens ---------------------------------------------------------

    public function test_api_tokens_expire(): void
    {
        $this->assertGreaterThan(0, config('sanctum.expiration'));
    }

    public function test_an_expired_token_is_refused(): void
    {
        $user = User::factory()->create();
        $token = $user->createToken('web');
        $token->accessToken->forceFill([
            'created_at' => now()->subMinutes(config('sanctum.expiration') + 1),
        ])->save();

        $this->withToken($token->plainTextToken)
            ->getJson('/api/v1/user')
            ->assertUnauthorized();
    }

    // --- CORS ---------------------------------------------------------------

    public function test_cors_does_not_allow_any_origin(): void
    {
        $this->assertNotContains('*', config('cors.allowed_origins'));

        // With one allowed origin the header always names that origin; the
        // browser then refuses to hand the response to any other page
        $allowed = $this->withHeaders(['Origin' => 'https://evil.example.com'])
            ->getJson('/api/v1/category/query')
            ->assertOk()
            ->headers->get('Access-Control-Allow-Origin');

        $this->assertNotSame('*', $allowed);
        $this->assertNotSame('https://evil.example.com', $allowed);
    }

    // --- Login --------------------------------------------------------------

    public function test_login_is_throttled_per_account_across_ips(): void
    {
        User::factory()->create(['email' => 'jane@example.com']);

        // A botnet: every guess from a new address, so the per-IP limit never trips
        for ($i = 1; $i <= 10; $i++) {
            $this->withServerVariables(['REMOTE_ADDR' => "10.0.0.{$i}"])
                ->postJson('/api/v1/login', ['email' => 'jane@example.com', 'password' => 'wrong'])
                ->assertStatus(422);
        }

        $this->withServerVariables(['REMOTE_ADDR' => '10.0.0.99'])
            ->postJson('/api/v1/login', ['email' => 'JANE@example.com', 'password' => 'wrong'])
            ->assertStatus(429);
    }

    public function test_login_is_still_throttled_per_ip(): void
    {
        for ($i = 1; $i <= 5; $i++) {
            $this->postJson('/api/v1/login', ['email' => "user{$i}@example.com", 'password' => 'wrong'])
                ->assertStatus(422);
        }

        $this->postJson('/api/v1/login', ['email' => 'user6@example.com', 'password' => 'wrong'])
            ->assertStatus(429);
    }

    // --- Reports ------------------------------------------------------------

    public function test_a_hidden_post_cannot_be_reported(): void
    {
        $pending = Post::factory()->create();
        Sanctum::actingAs(User::factory()->create());

        $this->postJson("/api/v1/post/{$pending->id}/report", ['reason' => 'Looks like spam'])
            ->assertNotFound();

        $this->assertDatabaseCount('reports', 0);
    }

    public function test_a_banned_user_cannot_report(): void
    {
        $post = Post::factory()->approved()->create();
        $reporter = User::factory()->create();
        $reporter->forceFill(['banned_at' => now()])->save();
        Sanctum::actingAs($reporter);

        $this->postJson("/api/v1/post/{$post->id}/report", ['reason' => 'Looks like spam'])
            ->assertForbidden();
    }

    public function test_a_public_post_can_still_be_reported(): void
    {
        $post = Post::factory()->approved()->create();
        Sanctum::actingAs(User::factory()->create());

        $this->postJson("/api/v1/post/{$post->id}/report", ['reason' => 'Looks like spam'])
            ->assertCreated();
    }

    // --- Messages -----------------------------------------------------------

    public function test_nobody_can_message_about_a_banned_authors_post(): void
    {
        $author = User::factory()->create();
        $post = Post::factory()->approved()->create(['user_id' => $author->id]);
        $author->forceFill(['banned_at' => now()])->save();
        Sanctum::actingAs(User::factory()->create());

        $this->postJson("/api/v1/post/{$post->id}/messages", ['body' => 'hello'])->assertNotFound();
        $this->getJson("/api/v1/post/{$post->id}/messages")->assertNotFound();
    }

    public function test_a_non_integer_user_id_is_a_422_not_a_server_error(): void
    {
        $author = User::factory()->create();
        $visitor = User::factory()->create();
        $post = Post::factory()->approved()->create(['user_id' => $author->id]);
        Message::create([
            'sender_id' => $visitor->id,
            'receiver_id' => $author->id,
            'post_id' => $post->id,
            'body' => 'hi',
        ]);
        Sanctum::actingAs($author);

        foreach (['1e3', '1.5', '-1', 'abc'] as $userId) {
            $this->getJson("/api/v1/post/{$post->id}/messages?user_id={$userId}")->assertStatus(422);
        }

        $this->getJson("/api/v1/post/{$post->id}/messages?user_id={$visitor->id}")->assertOk();
    }

    // --- Images -------------------------------------------------------------

    public function test_an_image_with_a_huge_pixel_count_is_refused_before_decoding(): void
    {
        Storage::fake('public');

        // A valid PNG header that claims 6000×6000 (36 MP) with almost no data:
        // getimagesize() reads only this, GD would try to allocate ~150 MB
        $png = tempnam(sys_get_temp_dir(), 'bomb');
        file_put_contents($png, $this->pngHeader(6000, 6000));

        $user = User::factory()->create(['email_verified_at' => now()]);

        $this->actingAs($user, 'sanctum')
            ->post('/api/v1/posts', [
                'type' => 'lost',
                'category_id' => Category::first()->id,
                'title' => 'Lost keys',
                'description' => 'Black keychain',
                'latitude' => 56.95,
                'longitude' => 24.1,
                'event_date' => now()->format('Y-m-d'),
                'images' => [new UploadedFile($png, 'bomb.png', 'image/png', null, true)],
            ], ['Accept' => 'application/json'])
            ->assertStatus(422)
            ->assertJsonValidationErrors(['images.0' => 'megapixels']);

        $this->assertDatabaseCount('posts', 0);
    }

    // --- Registration -------------------------------------------------------

    public function test_passwords_longer_than_bcrypt_can_use_are_refused(): void
    {
        $rules = (new RegisterRequest)->rules();
        $validator = validator(
            ['password' => str_repeat('a', 73), 'password_confirmation' => str_repeat('a', 73)],
            ['password' => $rules['password']],
        );

        $this->assertTrue($validator->fails());
    }

    /**
     * PNG signature plus an IHDR chunk (8-bit RGB) and an empty IEND.
     */
    private function pngHeader(int $width, int $height): string
    {
        $chunk = fn (string $type, string $data) => pack('N', strlen($data)).$type.$data.pack('N', crc32($type.$data));

        return "\x89PNG\r\n\x1a\n"
            .$chunk('IHDR', pack('NNCCCCC', $width, $height, 8, 2, 0, 0, 0))
            .$chunk('IEND', '');
    }
}
