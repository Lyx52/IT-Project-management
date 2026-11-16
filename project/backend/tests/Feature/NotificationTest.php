<?php

namespace Tests\Feature;

use App\Models\Post;
use App\Models\User;
use App\Notifications\PostModeratedNotification;
use App\Notifications\SavedSearchMatchNotification;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Notifications\DatabaseNotification;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class NotificationTest extends TestCase
{
    use RefreshDatabase;

    private User $user;

    protected function setUp(): void
    {
        parent::setUp();

        $this->user = User::factory()->create();
    }

    /**
     * Sends a saved-search notification about a new post and returns it.
     */
    private function notifyMatch(?User $user = null, string $postTitle = 'Found car keys'): DatabaseNotification
    {
        $user ??= $this->user;
        $search = $user->savedSearches()->create(['name' => fake()->unique()->words(3, true), 'q' => 'keys']);
        $post = Post::factory()->approved()->create(['title' => $postTitle]);

        $existing = $user->notifications()->pluck('id');

        $user->notify(new SavedSearchMatchNotification($search, $post));

        // Not latest(): notifications sent in the same second tie on created_at
        return $user->notifications()->whereNotIn('id', $existing)->sole();
    }

    public function test_guests_cannot_see_notifications(): void
    {
        $this->getJson('/api/v1/notifications')->assertUnauthorized();
        $this->postJson('/api/v1/notifications/read')->assertUnauthorized();
    }

    public function test_lists_the_users_notifications_with_a_short_type_and_the_data(): void
    {
        $notification = $this->notifyMatch(postTitle: 'Found car keys');
        Sanctum::actingAs($this->user);

        $this->getJson('/api/v1/notifications')
            ->assertOk()
            ->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.id', $notification->id)
            ->assertJsonPath('data.0.type', 'saved_search_match')
            ->assertJsonPath('data.0.details.post_title', 'Found car keys')
            ->assertJsonPath('data.0.details.post_id', $notification->data['post_id'])
            ->assertJsonPath('data.0.read_at', null)
            ->assertJsonPath('meta.unread_count', 1)
            ->assertJsonPath('meta.current_page', 1);
    }

    public function test_moderation_notifications_get_their_own_type(): void
    {
        $post = Post::factory()->approved()->create(['user_id' => $this->user->id]);
        $this->user->notify(new PostModeratedNotification($post));
        Sanctum::actingAs($this->user);

        $this->getJson('/api/v1/notifications')->assertJsonPath('data.0.type', 'post_moderated');
    }

    public function test_lists_newest_first_and_only_the_users_own(): void
    {
        $older = $this->notifyMatch();
        $this->travel(1)->minutes();
        $newer = $this->notifyMatch();
        $this->notifyMatch(User::factory()->create());
        Sanctum::actingAs($this->user);

        $ids = collect($this->getJson('/api/v1/notifications')->json('data'))->pluck('id')->all();

        $this->assertSame([$newer->id, $older->id], $ids);
    }

    public function test_unread_count_covers_every_page(): void
    {
        for ($i = 0; $i < 22; $i++) {
            $this->notifyMatch();
        }
        Sanctum::actingAs($this->user);

        $this->getJson('/api/v1/notifications')
            ->assertJsonCount(20, 'data')
            ->assertJsonPath('meta.unread_count', 22)
            ->assertJsonPath('meta.last_page', 2);
    }

    public function test_marks_one_notification_as_read(): void
    {
        $read = $this->notifyMatch();
        $unread = $this->notifyMatch();
        Sanctum::actingAs($this->user);

        $this->postJson("/api/v1/notification/{$read->id}/read")
            ->assertOk()
            ->assertJsonPath('data.id', $read->id)
            ->assertJsonPath('data.read_at', fn ($readAt) => $readAt !== null);

        $this->assertNotNull($read->fresh()->read_at);
        $this->assertNull($unread->fresh()->read_at);
        $this->getJson('/api/v1/notifications')->assertJsonPath('meta.unread_count', 1);
    }

    public function test_marking_a_read_notification_again_keeps_when_it_was_read(): void
    {
        $notification = $this->notifyMatch();
        Sanctum::actingAs($this->user);

        $this->postJson("/api/v1/notification/{$notification->id}/read");
        $firstReadAt = $notification->fresh()->read_at;
        $this->travel(1)->hours();
        $this->postJson("/api/v1/notification/{$notification->id}/read")->assertOk();

        $this->assertEquals($firstReadAt, $notification->fresh()->read_at);
    }

    public function test_another_users_notification_is_not_found(): void
    {
        $theirs = $this->notifyMatch(User::factory()->create());
        Sanctum::actingAs($this->user);

        $this->postJson("/api/v1/notification/{$theirs->id}/read")->assertNotFound();
        $this->postJson('/api/v1/notification/9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d/read')->assertNotFound();
        $this->assertNull($theirs->fresh()->read_at);
    }

    public function test_marks_all_of_the_users_notifications_as_read(): void
    {
        $this->notifyMatch();
        $this->notifyMatch();
        $theirs = $this->notifyMatch(User::factory()->create());
        Sanctum::actingAs($this->user);

        $this->postJson('/api/v1/notifications/read')->assertNoContent();

        $this->getJson('/api/v1/notifications')->assertJsonPath('meta.unread_count', 0);
        $this->assertNull($theirs->fresh()->read_at);
    }
}
