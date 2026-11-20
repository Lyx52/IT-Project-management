<?php

namespace Tests\Feature;

use App\Models\Category;
use App\Models\Post;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class AdminCategoryTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();

        Sanctum::actingAs(User::factory()->admin()->create());
    }

    public function test_creates_a_category(): void
    {
        $this->postJson('/api/v1/admin/categories', ['name' => 'Sunglasses'])
            ->assertStatus(201)
            ->assertJsonPath('data.name', 'Sunglasses')
            ->assertJsonPath('data.retired_at', null);
    }

    public function test_refuses_a_duplicate_name(): void
    {
        $this->postJson('/api/v1/admin/categories', ['name' => 'Bicycles'])
            ->assertStatus(422)
            ->assertJsonValidationErrors('name');
    }

    public function test_renames_a_category(): void
    {
        $category = Category::create(['name' => 'Bikes']);

        $this->patchJson("/api/v1/admin/categories/{$category->id}", ['name' => 'Sunglasses'])
            ->assertOk()
            ->assertJsonPath('data.name', 'Sunglasses');

        $this->assertSame('Sunglasses', $category->refresh()->name);
    }

    public function test_renaming_keeps_existing_posts_attached(): void
    {
        $category = Category::create(['name' => 'Bikes']);
        $post = Post::factory()->create(['category_id' => $category->id]);

        $this->patchJson("/api/v1/admin/categories/{$category->id}", ['name' => 'Sunglasses'])
            ->assertOk();

        $this->assertSame($category->id, $post->refresh()->category_id);
    }

    public function test_a_category_may_keep_its_own_name_when_renamed(): void
    {
        $category = Category::create(['name' => 'Skateboards']);

        // The unique check has to ignore the row being edited, or saving a form
        // without touching the name field would be refused.
        $this->patchJson("/api/v1/admin/categories/{$category->id}", ['name' => 'Skateboards'])
            ->assertOk();
    }

    public function test_retires_a_category_in_use_instead_of_deleting_it(): void
    {
        $category = Category::create(['name' => 'Bikes']);
        Post::factory()->create(['category_id' => $category->id]);

        $this->postJson("/api/v1/admin/categories/{$category->id}/retire")->assertOk();

        $this->assertNotNull($category->refresh()->retired_at);
    }

    public function test_a_retired_category_disappears_from_the_public_list(): void
    {
        $category = Category::create(['name' => 'Bikes']);

        $this->postJson("/api/v1/admin/categories/{$category->id}/retire")->assertOk();

        $names = collect($this->getJson('/api/v1/category/query')->assertOk()->json('data'))
            ->pluck('name');

        $this->assertFalse($names->contains('Bikes'));
    }

    public function test_a_retired_category_is_still_listed_for_admins(): void
    {
        $category = Category::create(['name' => 'Bikes']);
        $this->postJson("/api/v1/admin/categories/{$category->id}/retire")->assertOk();

        $names = collect($this->getJson('/api/v1/admin/categories')->assertOk()->json('data'))
            ->pluck('name');

        $this->assertTrue($names->contains('Bikes'));
    }

    public function test_restores_a_retired_category(): void
    {
        $category = Category::create(['name' => 'Bikes']);
        $this->postJson("/api/v1/admin/categories/{$category->id}/retire")->assertOk();

        $this->postJson("/api/v1/admin/categories/{$category->id}/restore")->assertOk();

        $this->assertNull($category->refresh()->retired_at);
    }

    public function test_deletes_a_category_nothing_uses(): void
    {
        $category = Category::create(['name' => 'Bikes']);

        $this->deleteJson("/api/v1/admin/categories/{$category->id}")->assertNoContent();

        $this->assertDatabaseMissing('categories', ['id' => $category->id]);
    }

    public function test_refuses_to_delete_a_category_that_posts_use(): void
    {
        $category = Category::create(['name' => 'Bikes']);
        Post::factory()->create(['category_id' => $category->id]);

        // 409 Conflict, not 422: the request is well formed, the category is
        // simply still in use. The frontend treats both as a shown message.
        $this->deleteJson("/api/v1/admin/categories/{$category->id}")
            ->assertStatus(409)
            ->assertJsonPath('message', 'A category used by a post cannot be deleted. Retire it instead.');

        $this->assertDatabaseHas('categories', ['id' => $category->id]);
    }

    public function test_reports_how_many_posts_use_each_category(): void
    {
        $category = Category::create(['name' => 'Bikes']);
        Post::factory()->count(2)->create(['category_id' => $category->id]);

        $row = collect($this->getJson('/api/v1/admin/categories')->assertOk()->json('data'))
            ->firstWhere('name', 'Bikes');

        $this->assertSame(2, $row['posts_count']);
    }

    public function test_is_closed_to_ordinary_users(): void
    {
        Sanctum::actingAs(User::factory()->create());

        $this->getJson('/api/v1/admin/categories')->assertStatus(403);
        $this->postJson('/api/v1/admin/categories', ['name' => 'Sneaky'])->assertStatus(403);
    }
}
