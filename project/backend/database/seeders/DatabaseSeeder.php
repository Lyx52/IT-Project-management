<?php

namespace Database\Seeders;

use App\Models\User;
use Illuminate\Database\Console\Seeds\WithoutModelEvents;
use Illuminate\Database\Seeder;

class DatabaseSeeder extends Seeder
{
    use WithoutModelEvents;

    /**
     * Seed the application's database.
     */
    public function run(): void
    {
        $this->call(CategorySeeder::class);

        // User::factory(10)->create();

        User::factory()->create([
            'username' => 'testuser',
            'email' => 'test@example.com',
        ]);

        // Local dev only, production never runs the seeder. The production
        // admin comes from deploy/create-admin.sh
        User::factory()->admin()->create([
            'username' => 'admin',
            'email' => 'admin@example.com',
        ]);
    }
}
