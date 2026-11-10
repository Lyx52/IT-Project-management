<?php

namespace Database\Factories;

use App\Enums\PostStatus;
use App\Enums\PostType;
use App\Models\Category;
use App\Models\Post;
use App\Models\User;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<Post>
 */
class PostFactory extends Factory
{
    /**
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        return [
            'user_id' => User::factory(),
            'category_id' => fn () => Category::query()->inRandomOrder()->value('id'),
            'type' => fake()->randomElement(PostType::cases()),
            'title' => fake()->sentence(4),
            'description' => fake()->paragraph(),
            'latitude' => fake()->latitude(56.8, 57.1),
            'longitude' => fake()->longitude(23.9, 24.3),
            'location_name' => fake()->streetName(),
            'event_date' => fake()->dateTimeBetween('-1 month')->format('Y-m-d'),
            'status' => PostStatus::Pending,
        ];
    }

    public function approved(): static
    {
        return $this->state(fn () => ['status' => PostStatus::Approved]);
    }

    public function rejected(): static
    {
        return $this->state(fn () => ['status' => PostStatus::Rejected]);
    }

    public function resolved(): static
    {
        return $this->state(fn () => ['status' => PostStatus::Resolved, 'resolved_at' => now()]);
    }
}
