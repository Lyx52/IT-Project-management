<?php

namespace Tests\Feature;

use App\Models\Message;
use App\Models\Post;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class ConversationsTest extends TestCase
{
    use RefreshDatabase;

    private function message(User $from, User $to, Post $post, string $body, bool $read = false): Message
    {
        $message = Message::create([
            'sender_id' => $from->id,
            'receiver_id' => $to->id,
            'post_id' => $post->id,
            'body' => $body,
        ]);

        if ($read) {
            $message->forceFill(['read_at' => now()])->save();
        }

        return $message;
    }

    public function test_requires_a_token(): void
    {
        $this->getJson('/api/v1/messages/conversations')->assertUnauthorized();
    }

    public function test_lists_one_conversation_per_post_and_person_with_last_message_and_unread_count(): void
    {
        $author = User::factory()->create();
        $alex = User::factory()->create(['username' => 'Alex']);
        $maria = User::factory()->create(['username' => 'Maria']);
        $post = Post::factory()->approved()->create(['user_id' => $author->id, 'title' => 'Lost keys']);

        $this->message($alex, $author, $post, 'Hi');
        $last = $this->message($alex, $author, $post, 'Hello, I found something similar.');
        $this->message($maria, $author, $post, 'Is this your item?');
        $this->message($author, $maria, $post, 'Yes!', read: true);

        Sanctum::actingAs($author);
        $response = $this->getJson('/api/v1/messages/conversations')->assertOk();

        $response->assertJsonCount(2, 'data');
        // Maria's conversation has the newest message, so it comes first
        $response->assertJsonPath('data.0.other_user.username', 'Maria')
            ->assertJsonPath('data.0.last_message.body', 'Yes!')
            ->assertJsonPath('data.0.last_message.sender_id', $author->id)
            ->assertJsonPath('data.0.unread_count', 1);
        $response->assertJsonPath('data.1.post_id', $post->id)
            ->assertJsonPath('data.1.post_title', 'Lost keys')
            ->assertJsonPath('data.1.other_user', ['id' => $alex->id, 'username' => 'Alex'])
            ->assertJsonPath('data.1.last_message.id', $last->id)
            ->assertJsonPath('data.1.unread_count', 2);
    }

    public function test_the_same_person_on_two_posts_is_two_conversations_and_strangers_are_left_out(): void
    {
        $me = User::factory()->create();
        $other = User::factory()->create();
        $first = Post::factory()->approved()->create(['user_id' => $other->id]);
        $second = Post::factory()->approved()->create(['user_id' => $other->id]);
        $this->message($me, $other, $first, 'a');
        $this->message($me, $other, $second, 'b');
        $this->message(User::factory()->create(), $other, $first, 'not mine');

        Sanctum::actingAs($me);

        $this->getJson('/api/v1/messages/conversations')->assertOk()->assertJsonCount(2, 'data');
    }

    public function test_leaves_out_conversations_about_posts_the_user_cannot_see(): void
    {
        $me = User::factory()->create();
        $author = User::factory()->create();
        $post = Post::factory()->approved()->create(['user_id' => $author->id]);
        $this->message($me, $author, $post, 'hi');
        $post->forceFill(['status' => 'rejected'])->save();

        Sanctum::actingAs($me);

        $this->getJson('/api/v1/messages/conversations')->assertOk()->assertJsonCount(0, 'data');
    }
}
