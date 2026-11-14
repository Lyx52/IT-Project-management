<?php

namespace Tests\Feature;

use App\Models\Category;
use App\Models\SavedSearch;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class SavedSearchTest extends TestCase
{
    use RefreshDatabase;

    private User $user;

    private int $keys;

    protected function setUp(): void
    {
        parent::setUp();

        $this->user = User::factory()->create();
        $this->keys = Category::where('name', 'Keys')->value('id');
    }

    private function saveSearch(array $attributes = [], ?User $user = null): SavedSearch
    {
        return ($user ?? $this->user)->savedSearches()->forceCreate([
            'name' => 'My keys',
            'q' => 'keys',
            ...$attributes,
        ]);
    }

    public function test_guests_cannot_use_saved_searches(): void
    {
        $search = $this->saveSearch();

        $this->getJson('/api/v1/saved-searches')->assertUnauthorized();
        $this->postJson('/api/v1/saved-searches', ['name' => 'x', 'q' => 'keys'])->assertUnauthorized();
        $this->patchJson("/api/v1/saved-search/{$search->id}", ['name' => 'x'])->assertUnauthorized();
        $this->deleteJson("/api/v1/saved-search/{$search->id}")->assertUnauthorized();
    }

    public function test_saves_the_search_and_filters_under_a_name(): void
    {
        Sanctum::actingAs($this->user);

        $response = $this->postJson('/api/v1/saved-searches', [
            'name' => 'Car keys near work',
            'q' => 'car keys',
            'type' => 'found',
            'category_id' => $this->keys,
        ]);

        $response->assertCreated()
            ->assertJsonPath('data.name', 'Car keys near work')
            ->assertJsonPath('data.q', 'car keys')
            ->assertJsonPath('data.type', 'found')
            ->assertJsonPath('data.category.id', $this->keys)
            ->assertJsonPath('data.category.name', 'Keys');

        $this->assertDatabaseHas('saved_searches', [
            'id' => $response->json('data.id'),
            'user_id' => $this->user->id,
            'name' => 'Car keys near work',
            'q' => 'car keys',
            'type' => 'found',
            'category_id' => $this->keys,
        ]);
    }

    public function test_a_single_filter_is_enough(): void
    {
        Sanctum::actingAs($this->user);

        $this->postJson('/api/v1/saved-searches', ['name' => 'Text', 'q' => 'wallet'])->assertCreated();
        $this->postJson('/api/v1/saved-searches', ['name' => 'Type', 'type' => 'found'])
            ->assertCreated()
            ->assertJsonPath('data.q', null)
            ->assertJsonPath('data.category', null);
        $this->postJson('/api/v1/saved-searches', ['name' => 'Category', 'category_id' => $this->keys])->assertCreated();
    }

    public function test_needs_a_name_and_at_least_one_filter(): void
    {
        Sanctum::actingAs($this->user);

        $this->postJson('/api/v1/saved-searches', ['q' => 'keys'])
            ->assertUnprocessable()
            ->assertJsonValidationErrors('name');

        // Blank text is no filter either
        $this->postJson('/api/v1/saved-searches', ['name' => 'Everything', 'q' => '   '])
            ->assertUnprocessable()
            ->assertJsonValidationErrors('q');

        $this->assertDatabaseCount('saved_searches', 0);
    }

    public function test_validates_the_filters(): void
    {
        Sanctum::actingAs($this->user);

        $this->postJson('/api/v1/saved-searches', [
            'name' => str_repeat('n', 51),
            'q' => str_repeat('a', 101),
            'type' => 'stolen',
            'category_id' => 999999,
        ])
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['name', 'q', 'type', 'category_id']);
    }

    public function test_names_are_unique_per_user(): void
    {
        $this->saveSearch(['name' => 'Keys']);
        $this->saveSearch(['name' => 'Keys'], User::factory()->create());

        Sanctum::actingAs($this->user);

        $this->postJson('/api/v1/saved-searches', ['name' => 'Keys', 'q' => 'other'])
            ->assertUnprocessable()
            ->assertJsonValidationErrors('name');

        Sanctum::actingAs(User::factory()->create());

        $this->postJson('/api/v1/saved-searches', ['name' => 'Keys', 'q' => 'other'])->assertCreated();
    }

    public function test_a_user_can_save_at_most_the_limit(): void
    {
        foreach (range(1, SavedSearch::LIMIT) as $i) {
            $this->saveSearch(['name' => "Search {$i}"]);
        }

        Sanctum::actingAs($this->user);

        $this->postJson('/api/v1/saved-searches', ['name' => 'One more', 'q' => 'keys'])
            ->assertUnprocessable()
            ->assertJsonPath('message', 'You can save at most 20 searches. Delete one first.');

        $this->assertSame(SavedSearch::LIMIT, $this->user->savedSearches()->count());
    }

    public function test_lists_only_the_users_own_searches_newest_first(): void
    {
        $older = $this->saveSearch(['name' => 'Older', 'created_at' => now()->subDay()]);
        $newer = $this->saveSearch(['name' => 'Newer', 'category_id' => $this->keys]);
        $this->saveSearch(['name' => 'Not mine'], User::factory()->create());

        Sanctum::actingAs($this->user);

        $response = $this->getJson('/api/v1/saved-searches')->assertOk();

        $this->assertSame([$newer->id, $older->id], $response->json('data.*.id'));
        $response->assertJsonPath('data.0.category.name', 'Keys');
    }

    public function test_renames_a_search_and_keeps_its_filters(): void
    {
        $search = $this->saveSearch(['type' => 'lost', 'category_id' => $this->keys]);

        Sanctum::actingAs($this->user);

        $this->patchJson("/api/v1/saved-search/{$search->id}", [
            'name' => 'Renamed',
            'q' => 'changed',
            'type' => 'found',
        ])
            ->assertOk()
            ->assertJsonPath('data.name', 'Renamed')
            ->assertJsonPath('data.q', 'keys')
            ->assertJsonPath('data.type', 'lost');

        $this->assertDatabaseHas('saved_searches', [
            'id' => $search->id,
            'name' => 'Renamed',
            'q' => 'keys',
            'type' => 'lost',
            'category_id' => $this->keys,
        ]);
    }

    public function test_rename_validates_the_name(): void
    {
        $search = $this->saveSearch(['name' => 'Keys']);
        $this->saveSearch(['name' => 'Wallet']);

        Sanctum::actingAs($this->user);

        $this->patchJson("/api/v1/saved-search/{$search->id}", [])
            ->assertUnprocessable()
            ->assertJsonValidationErrors('name');
        $this->patchJson("/api/v1/saved-search/{$search->id}", ['name' => 'Wallet'])
            ->assertUnprocessable()
            ->assertJsonValidationErrors('name');

        // Keeping its own name is fine
        $this->patchJson("/api/v1/saved-search/{$search->id}", ['name' => 'Keys'])->assertOk();
    }

    public function test_deletes_a_search(): void
    {
        $search = $this->saveSearch();

        Sanctum::actingAs($this->user);

        $this->deleteJson("/api/v1/saved-search/{$search->id}")->assertNoContent();

        $this->assertModelMissing($search);
    }

    public function test_other_users_searches_are_not_found(): void
    {
        $search = $this->saveSearch();

        Sanctum::actingAs(User::factory()->create());

        // 404 even with an invalid body, so it doesn't reveal the search exists
        $this->patchJson("/api/v1/saved-search/{$search->id}", ['name' => ''])->assertNotFound();
        $this->patchJson("/api/v1/saved-search/{$search->id}", ['name' => 'Mine now'])->assertNotFound();
        $this->deleteJson("/api/v1/saved-search/{$search->id}")->assertNotFound();

        $this->assertDatabaseHas('saved_searches', ['id' => $search->id, 'name' => 'My keys']);
    }

    public function test_unknown_search_is_not_found(): void
    {
        Sanctum::actingAs($this->user);

        $this->patchJson('/api/v1/saved-search/999999', ['name' => 'x'])->assertNotFound();
        $this->deleteJson('/api/v1/saved-search/999999')->assertNotFound();
    }
}
