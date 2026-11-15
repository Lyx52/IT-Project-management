<?php

namespace Tests\Feature;

use App\Enums\PostStatus;
use App\Enums\PostType;
use App\Models\Category;
use App\Models\Post;
use App\Models\SavedSearch;
use App\Models\User;
use App\Notifications\SavedSearchMatchNotification;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Notification;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class SavedSearchNotificationTest extends TestCase
{
    use RefreshDatabase;

    private User $admin;

    private User $searcher;

    private int $keys;

    protected function setUp(): void
    {
        parent::setUp();

        $this->admin = User::factory()->admin()->create();
        $this->searcher = User::factory()->create();
        $this->keys = Category::where('name', 'Keys')->value('id');
    }

    private function saveSearch(array $attributes = [], ?User $user = null): SavedSearch
    {
        return ($user ?? $this->searcher)->savedSearches()->create([
            'name' => fake()->unique()->words(3, true),
            ...$attributes,
        ]);
    }

    /**
     * A pending found post about car keys, unless overridden.
     */
    private function pendingPost(array $attributes = []): Post
    {
        return Post::factory()->create([
            'type' => PostType::Found,
            'category_id' => $this->keys,
            'title' => 'Atrastas mašīnas atslēgas',
            'description' => 'Black car key with a red keyring',
            ...$attributes,
        ]);
    }

    private function approve(Post $post): void
    {
        Sanctum::actingAs($this->admin);

        $this->postJson("/api/v1/admin/posts/{$post->id}/approve")->assertOk();
    }

    /**
     * @return list<int> ids of the saved searches the user was notified about
     */
    private function notifiedSearches(?User $user = null): array
    {
        return ($user ?? $this->searcher)->notifications()
            ->where('type', SavedSearchMatchNotification::class)
            ->get()
            ->pluck('data.saved_search_id')
            ->all();
    }

    public function test_approving_a_matching_post_notifies_the_searcher(): void
    {
        $search = $this->saveSearch([
            'name' => 'My car keys',
            'q' => 'masinas atslegas',
            'type' => 'found',
            'category_id' => $this->keys,
        ]);
        $post = $this->pendingPost();

        $this->approve($post);

        $notification = $this->searcher->notifications()->sole();
        $this->assertSame(SavedSearchMatchNotification::class, $notification->type);
        $this->assertSame([
            'saved_search_id' => $search->id,
            'saved_search_name' => 'My car keys',
            'post_id' => $post->id,
            'post_title' => 'Atrastas mašīnas atslēgas',
            'post_type' => 'found',
            'message' => 'A new post matches your saved search "My car keys".',
        ], $notification->data);
    }

    public function test_only_matching_searches_are_notified(): void
    {
        $byText = $this->saveSearch(['q' => 'RED keyring']);
        $byType = $this->saveSearch(['type' => 'found']);
        $byCategory = $this->saveSearch(['category_id' => $this->keys]);
        $this->saveSearch(['q' => 'wallet']);
        $this->saveSearch(['q' => 'keyring', 'type' => 'lost']);
        $this->saveSearch(['q' => 'keyring', 'category_id' => Category::where('name', 'Phones')->value('id')]);

        $this->approve($this->pendingPost());

        $this->assertEqualsCanonicalizing([$byText->id, $byType->id, $byCategory->id], $this->notifiedSearches());
    }

    public function test_every_users_matching_search_is_notified(): void
    {
        $other = User::factory()->create();
        $mine = $this->saveSearch(['q' => 'keys']);
        $theirs = $this->saveSearch(['q' => 'keys'], $other);

        $this->approve($this->pendingPost(['title' => 'Keys']));

        $this->assertSame([$mine->id], $this->notifiedSearches());
        $this->assertSame([$theirs->id], $this->notifiedSearches($other));
    }

    public function test_the_author_is_not_notified_about_their_own_post(): void
    {
        $this->saveSearch(['q' => 'keys']);

        $this->approve($this->pendingPost(['title' => 'Keys', 'user_id' => $this->searcher->id]));

        $this->assertSame([], $this->notifiedSearches());
    }

    public function test_banned_users_are_not_notified(): void
    {
        $this->saveSearch(['q' => 'keys']);
        $this->searcher->forceFill(['banned_at' => now()])->save();

        $this->approve($this->pendingPost(['title' => 'Keys']));

        $this->assertSame([], $this->notifiedSearches());
    }

    public function test_rejected_and_unmoderated_posts_notify_nobody(): void
    {
        $this->saveSearch(['q' => 'keys']);
        $rejected = $this->pendingPost(['title' => 'Keys']);
        $this->pendingPost(['title' => 'Keys']);

        Sanctum::actingAs($this->admin);
        $this->postJson("/api/v1/admin/posts/{$rejected->id}/reject")->assertOk();

        $this->assertSame([], $this->notifiedSearches());
    }

    public function test_a_post_approved_again_after_an_edit_notifies_only_once(): void
    {
        $search = $this->saveSearch(['q' => 'keys']);
        $post = $this->pendingPost(['title' => 'Keys']);
        $this->approve($post);

        // Editing sends the post back to moderation
        Sanctum::actingAs($post->user);
        $this->postJson("/api/v1/post/{$post->id}", ['title' => 'Car keys'])
            ->assertOk()
            ->assertJsonPath('data.status', PostStatus::Pending->value);
        $this->approve($post);

        $this->assertSame([$search->id], $this->notifiedSearches());
    }

    public function test_an_edit_that_starts_matching_notifies(): void
    {
        $search = $this->saveSearch(['q' => 'umbrella']);
        $post = $this->pendingPost(['title' => 'Keys']);
        $this->approve($post);

        Sanctum::actingAs($post->user);
        $this->postJson("/api/v1/post/{$post->id}", ['title' => 'Keys and an umbrella'])->assertOk();
        $this->approve($post);

        $this->assertSame([$search->id], $this->notifiedSearches());
    }

    public function test_a_deleted_search_stops_notifying(): void
    {
        $search = $this->saveSearch(['q' => 'keys']);
        Sanctum::actingAs($this->searcher);
        $this->deleteJson("/api/v1/saved-search/{$search->id}")->assertNoContent();

        Notification::fake();
        $this->approve($this->pendingPost(['title' => 'Keys']));

        Notification::assertNotSentTo($this->searcher, SavedSearchMatchNotification::class);
    }

    public function test_search_endpoint_and_saved_search_agree(): void
    {
        $filters = ['q' => 'atslegas', 'type' => 'found', 'category_id' => $this->keys];
        $search = $this->saveSearch($filters);
        $post = $this->pendingPost();
        $this->approve($post);

        $found = $this->getJson('/api/v1/posts/query?'.http_build_query($filters))->json('data.*.id');

        $this->assertSame([$post->id], $found);
        $this->assertSame([$search->id], $this->notifiedSearches());
    }
}
