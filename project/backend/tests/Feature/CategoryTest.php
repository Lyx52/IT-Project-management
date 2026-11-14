<?php

namespace Tests\Feature;

use Database\Seeders\CategorySeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class CategoryTest extends TestCase
{
    use RefreshDatabase;

    public function test_it_returns_all_categories_without_pagination(): void
    {
        $this->seed(CategorySeeder::class);

        $this->getJson('/api/v1/category/query')
            ->assertOk()
            ->assertJsonCount(9, 'data')
            ->assertJsonPath('data.0', ['id' => 1, 'name' => 'Electronics'])
            ->assertJsonPath('data.8', ['id' => 9, 'name' => 'Other'])
            ->assertJsonMissingPath('links')
            ->assertJsonMissingPath('meta');
    }
}
