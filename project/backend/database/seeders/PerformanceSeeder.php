<?php

namespace Database\Seeders;

use App\Models\User;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use RuntimeException;

class PerformanceSeeder extends Seeder
{
    private const POST_COUNT = 10_000;

    private const TITLES = [
        'wallet', 'keys', 'phone', 'backpack', 'jacket', 'headphones',
        'document folder', 'water bottle', 'umbrella', 'camera',
    ];

    private const LOCATIONS = [
        'Jelgava Railway Station', 'Jelgava Old Town', 'Jelgava Palace',
        'Lielupe Riverside', 'Jelgava Market', 'Jelgava University',
    ];

    public function run(): void
    {
        if (app()->environment('production')) {
            throw new RuntimeException('PerformanceSeeder must never run in production.');
        }

        $user = User::withTrashed()->firstOrCreate(
            ['email' => 'performance-dataset@findit.test'],
            [
                'username' => 'performance-dataset',
                'password' => bcrypt(Str::random(40)),
                'terms_accepted_at' => now(),
                'privacy_policy_version' => '1.0',
            ],
        );

        if ($user->trashed()) {
            $user->restore();
        }

        $categoryIds = DB::table('categories')->orderBy('id')->pluck('id')->all();
        if ($categoryIds === []) {
            throw new RuntimeException('No categories found. Run the application migrations first.');
        }

        DB::table('posts')->where('user_id', $user->id)->delete();

        $now = now();
        $statuses = ['approved', 'approved', 'approved', 'approved', 'pending', 'resolved', 'rejected'];

        for ($offset = 0; $offset < self::POST_COUNT; $offset += 500) {
            $batch = [];

            for ($number = $offset + 1; $number <= min($offset + 500, self::POST_COUNT); $number++) {
                $title = self::TITLES[$number % count(self::TITLES)];
                $location = self::LOCATIONS[$number % count(self::LOCATIONS)];
                $status = $statuses[$number % count($statuses)];
                $createdAt = $now->copy()->subDays($number % 365)->subMinutes($number % 1440);

                $batch[] = [
                    'user_id' => $user->id,
                    'category_id' => $categoryIds[$number % count($categoryIds)],
                    'type' => $number % 2 === 0 ? 'lost' : 'found',
                    'title' => "Benchmark: {$title} #{$number}",
                    'description' => "Benchmark dataset item {$number}: {$title} reported near {$location}. "
                        .'This realistic sample helps measure repeatable search and page response times.',
                    'latitude' => 56.64 + (($number % 250) / 10_000),
                    'longitude' => 23.70 + (($number % 350) / 10_000),
                    'location_name' => $location,
                    'event_date' => $createdAt->toDateString(),
                    'status' => $status,
                    'resolved_at' => $status === 'resolved' ? $createdAt->copy()->addDays(1) : null,
                    'created_at' => $createdAt,
                    'updated_at' => $createdAt,
                ];
            }

            DB::table('posts')->insert($batch);
        }

        $this->command?->info('Seeded '.self::POST_COUNT.' repeatable performance posts.');
    }
}
