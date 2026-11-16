<?php

namespace Tests\Feature;

use App\Models\Category;
use App\Models\Post;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class ResolvePostTest extends TestCase
{
    use RefreshDatabase;

    private User $author;

    private Post $post;

    protected function setUp(): void
    {
        parent::setUp();
        Category::firstOrCreate(['name' => 'Keys']);
        $this->author = User::factory()->create();
        $this->post = Post::factory()->approved()->create(['user_id' => $this->author->id]);
    }

    private function url(?Post $post = null): string
    {
        return '/api/v1/post/'.($post ?? $this->post)->id.'/resolve';
    }

    public function test_author_resolves_their_post_with_a_timestamp(): void
    {
        Sanctum::actingAs($this->author);

        $this->postJson($this->url())
            ->assertOk()
            ->assertJsonPath('data.status', 'resolved')
            ->assertJsonPath('data.resolved_at', fn ($value) => $value !== null);

        $this->post->refresh();
        $this->assertSame('resolved', $this->post->status->value);
        $this->assertNotNull($this->post->resolved_at);
    }

    public function test_resolved_post_leaves_the_feed_but_stays_reachable_by_link(): void
    {
        Sanctum::actingAs($this->author);
        $this->postJson($this->url())->assertOk();

        $this->app['auth']->forgetGuards();

        $this->getJson('/api/v1/posts')
            ->assertOk()
            ->assertJsonMissing(['id' => $this->post->id]);

        $this->getJson('/api/v1/post/'.$this->post->id)
            ->assertOk()
            ->assertJsonPath('data.status', 'resolved');
    }

    public function test_guest_cannot_resolve(): void
    {
        $this->postJson($this->url())->assertUnauthorized();
    }

    public function test_other_users_cannot_resolve(): void
    {
        Sanctum::actingAs(User::factory()->create());

        $this->postJson($this->url())->assertForbidden();
        $this->assertSame('approved', $this->post->refresh()->status->value);
    }

    public function test_admin_cannot_resolve_someone_elses_post(): void
    {
        Sanctum::actingAs(User::factory()->admin()->create());

        $this->postJson($this->url())->assertForbidden();
    }

    public function test_only_approved_posts_can_be_resolved(): void
    {
        Sanctum::actingAs($this->author);

        foreach (['pending' => Post::factory(), 'rejected' => Post::factory()->rejected(), 'resolved' => Post::factory()->resolved()] as $state => $factory) {
            $post = $factory->create(['user_id' => $this->author->id]);

            $this->postJson($this->url($post))->assertForbidden();
            $this->assertSame($state, $post->refresh()->status->value);
        }
    }

    public function test_banned_author_cannot_resolve(): void
    {
        $this->author->forceFill(['banned_at' => now()])->save();
        Sanctum::actingAs($this->author);

        $this->postJson($this->url())->assertForbidden();
    }
}
