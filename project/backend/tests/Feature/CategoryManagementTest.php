<?php

namespace Tests\Feature;

use App\Models\Category;
use App\Models\Post;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class CategoryManagementTest extends TestCase
{
    use RefreshDatabase;

    public function test_public_list_contains_required_categories_and_hides_retired_categories(): void
    {
        $temporary = Category::query()->create(['name' => 'Temporary']);
        $temporary->retired_at = now();
        $temporary->save();

        $response = $this->getJson('/api/v1/category/query')->assertOk();
        $names = collect($response->json('data'))
            ->pluck('name')
            ->map(fn (string $name) => strtolower($name));

        foreach (['documents', 'keys', 'phones', 'bags', 'clothing', 'jewellery', 'electronics', 'pets', 'bicycles', 'other'] as $required) {
            $this->assertTrue(
                $names->contains(fn (string $name) => str_contains($name, $required)),
                "The category list should include {$required}."
            );
        }

        $this->assertTrue($names->contains(fn (string $name) => str_contains($name, 'wallet')));
        $this->assertFalse($names->contains('temporary'));
    }

    public function test_admin_can_add_and_rename_a_category(): void
    {
        $admin = User::factory()->admin()->create();
        $this->actingAs($admin, 'sanctum');

        $created = $this->postJson('/api/v1/admin/categories', ['name' => 'Backpacks'])
            ->assertCreated()
            ->assertJsonPath('name', 'Backpacks');

        $id = $created->json('id');

        $this->patchJson("/api/v1/admin/categories/{$id}", ['name' => 'School bags'])
            ->assertOk()
            ->assertJsonPath('name', 'School bags');
    }

    public function test_category_names_are_unique_ignoring_capitalization(): void
    {
        $admin = User::factory()->admin()->create();
        $this->actingAs($admin, 'sanctum');

        $this->postJson('/api/v1/admin/categories', ['name' => 'Backpacks'])->assertCreated();

        $this->postJson('/api/v1/admin/categories', ['name' => 'backpacks'])
            ->assertUnprocessable()
            ->assertJsonValidationErrors('name');
    }

    public function test_non_admin_cannot_manage_categories(): void
    {
        $user = User::factory()->create();
        $this->actingAs($user, 'sanctum');

        $this->getJson('/api/v1/admin/categories')->assertForbidden();

        $this->postJson('/api/v1/admin/categories', ['name' => 'Backpacks'])
            ->assertForbidden();
    }

    public function test_guest_cannot_manage_categories(): void
    {
        $this->getJson('/api/v1/admin/categories')->assertUnauthorized();

        $this->postJson('/api/v1/admin/categories', ['name' => 'Backpacks'])
            ->assertUnauthorized();
    }

    public function test_used_category_can_be_retired_but_cannot_be_deleted(): void
    {
        $admin = User::factory()->admin()->create();
        $category = Category::query()->where('name', 'Phones')->firstOrFail();
        $post = Post::factory()->create(['category_id' => $category->id]);

        $this->actingAs($admin, 'sanctum');

        $this->postJson("/api/v1/admin/categories/{$category->id}/retire")
            ->assertOk();

        $this->assertNotNull($category->fresh()->retired_at);
        $this->assertDatabaseHas('posts', [
            'id' => $post->id,
            'category_id' => $category->id,
        ]);

        $this->deleteJson("/api/v1/admin/categories/{$category->id}")
            ->assertStatus(409);

        $this->assertDatabaseHas('categories', ['id' => $category->id]);
    }

    public function test_unused_category_can_be_restored_and_deleted(): void
    {
        $admin = User::factory()->admin()->create();
        $this->actingAs($admin, 'sanctum');

        $id = $this->postJson('/api/v1/admin/categories', ['name' => 'Umbrellas'])
            ->assertCreated()
            ->json('id');

        $this->postJson("/api/v1/admin/categories/{$id}/retire")->assertOk();

        $this->postJson("/api/v1/admin/categories/{$id}/restore")
            ->assertOk()
            ->assertJsonPath('retired_at', null);

        $this->deleteJson("/api/v1/admin/categories/{$id}")->assertNoContent();

        $this->assertDatabaseMissing('categories', ['id' => $id]);
    }

    public function test_new_post_cannot_use_a_retired_category(): void
    {
        $category = Category::query()->where('name', 'Phones')->firstOrFail();
        $category->retired_at = now();
        $category->save();

        $user = User::factory()->create();

        $this->actingAs($user, 'sanctum')
            ->postJson('/api/v1/posts', [
                'type' => 'lost',
                'category_id' => $category->id,
                'title' => 'Lost phone',
                'description' => 'Black phone',
                'latitude' => 56.95,
                'longitude' => 24.1,
                'event_date' => now()->toDateString(),
            ])
            ->assertUnprocessable()
            ->assertJsonValidationErrors('category_id');
    }
}
