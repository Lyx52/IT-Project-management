<?php

namespace Tests\Feature;

use App\Models\Category;
use App\Models\Message;
use App\Models\Post;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class MessageTest extends TestCase
{
    use RefreshDatabase;

    private User $author;

    private User $visitor;

    private Post $post;

    protected function setUp(): void
    {
        parent::setUp();
        Category::firstOrCreate(['name' => 'Keys']);
        $this->author = User::factory()->create(['email' => 'author@secret.lv']);
        $this->visitor = User::factory()->create(['email' => 'visitor@secret.lv']);
        $this->post = Post::factory()->approved()->create(['user_id' => $this->author->id]);
    }

    private function url(?Post $post = null): string
    {
        return '/api/v1/post/'.($post ?? $this->post)->id.'/messages';
    }

    public function test_visitor_messages_the_author_and_it_is_tied_to_the_post(): void
    {
        Sanctum::actingAs($this->visitor);

        $this->postJson($this->url(), ['body' => 'I found your keys'])
            ->assertCreated()
            ->assertJsonPath('data.post_id', $this->post->id)
            ->assertJsonPath('data.body', 'I found your keys')
            ->assertJsonPath('data.sender.id', $this->visitor->id)
            ->assertJsonPath('data.receiver.id', $this->author->id);
    }

    public function test_body_is_encrypted_at_rest(): void
    {
        Sanctum::actingAs($this->visitor);
        $this->postJson($this->url(), ['body' => 'plain secret text'])->assertCreated();

        $raw = DB::table('messages')->value('body');

        $this->assertStringNotContainsString('plain secret text', $raw);
        $this->assertSame('plain secret text', Message::first()->body);
    }

    public function test_email_addresses_are_never_exposed(): void
    {
        Sanctum::actingAs($this->visitor);
        $sent = $this->postJson($this->url(), ['body' => 'hi'])->assertCreated();
        $read = $this->getJson($this->url())->assertOk();

        foreach ([$sent->getContent(), $read->getContent()] as $json) {
            $this->assertStringNotContainsString('secret.lv', $json);
            $this->assertStringNotContainsString('"email"', $json);
        }
    }

    public function test_author_can_reply_only_to_someone_who_wrote(): void
    {
        Sanctum::actingAs($this->author);
        $this->postJson($this->url(), ['body' => 'hello', 'user_id' => $this->visitor->id])->assertForbidden();
        $this->postJson($this->url(), ['body' => 'hello'])->assertUnprocessable();

        Message::create(['sender_id' => $this->visitor->id, 'receiver_id' => $this->author->id, 'post_id' => $this->post->id, 'body' => 'hi']);

        $this->postJson($this->url(), ['body' => 'hello', 'user_id' => $this->visitor->id])
            ->assertCreated()
            ->assertJsonPath('data.receiver.id', $this->visitor->id);
    }

    public function test_conversation_is_private_and_marks_messages_read(): void
    {
        $stranger = User::factory()->create();
        Message::create(['sender_id' => $this->visitor->id, 'receiver_id' => $this->author->id, 'post_id' => $this->post->id, 'body' => 'hi']);

        Sanctum::actingAs($stranger);
        $this->getJson($this->url())->assertOk()->assertJsonCount(0, 'data');

        Sanctum::actingAs($this->author);
        $this->getJson($this->url().'?user_id='.$stranger->id)->assertNotFound();
        $this->getJson($this->url().'?user_id='.$this->visitor->id)->assertOk()->assertJsonCount(1, 'data');
        $this->assertNotNull(Message::first()->read_at);
    }

    public function test_cannot_message_about_an_unapproved_post_or_as_unverified_or_banned(): void
    {
        $pending = Post::factory()->create(['user_id' => $this->author->id]);

        Sanctum::actingAs($this->visitor);
        $this->postJson($this->url($pending), ['body' => 'x'])->assertNotFound();

        Sanctum::actingAs(User::factory()->unverified()->create());
        $this->postJson($this->url(), ['body' => 'x'])->assertForbidden();

        $banned = User::factory()->create(['banned_at' => now()]);
        $banned->forceFill(['banned_at' => now()])->save();
        Sanctum::actingAs($banned);
        $this->postJson($this->url(), ['body' => 'x'])->assertForbidden();

        $this->assertSame(0, Message::count());
    }

    public function test_requires_auth_and_a_valid_body(): void
    {
        $this->postJson($this->url(), ['body' => 'x'])->assertUnauthorized();

        Sanctum::actingAs($this->visitor);
        $this->postJson($this->url(), [])->assertUnprocessable();
        $this->postJson($this->url(), ['body' => str_repeat('a', 2001)])->assertUnprocessable();
    }
}
