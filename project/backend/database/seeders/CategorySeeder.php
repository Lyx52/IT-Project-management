<?php

namespace Database\Seeders;

use App\Models\Category;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;

class CategorySeeder extends Seeder
{
    /**
     * The default item categories, keyed by their stable IDs.
     *
     * @var array<int, string>
     */
    private const CATEGORIES = [
        1 => 'Electronics',
        2 => 'Jewelry & Accessories',
        3 => 'Bags & Backpacks',
        4 => 'Clothing',
        5 => 'Documents',
        6 => 'Keys',
        7 => 'Wallets & Money',
        8 => 'Sports & Hobbies',
        9 => 'Other',
    ];

    /**
     * Seed the item categories.
     */
    public function run(): void
    {
        DB::transaction(function (): void {
            $ids = array_keys(self::CATEGORIES);

            // Remove categories that are no longer in the list, unless a post
            // still references them (the foreign key restricts deletion).
            Category::query()
                ->whereNotIn('id', $ids)
                ->whereDoesntHave('posts')
                ->delete();

            $existing = Category::query()->pluck('name', 'id');

            // Renaming an ID can clash with another row's current name (for
            // example id 6 is "Electronics", and id 1 becomes "Electronics").
            // Move the existing rows aside before assigning the new names.
            foreach ($existing->keys() as $id) {
                Category::query()->whereKey($id)->update(['name' => "__category_{$id}"]);
            }

            foreach (self::CATEGORIES as $id => $name) {
                Category::query()->updateOrCreate(['id' => $id], ['name' => $name]);
            }

            // Keep categories that posts still use, restoring their old name
            // (or making it unique if one of the new names now uses it).
            foreach ($existing as $id => $name) {
                if (in_array($id, $ids, true)) {
                    continue;
                }

                Category::query()->whereKey($id)->update([
                    'name' => in_array($name, self::CATEGORIES, true) ? "{$name} ({$id})" : $name,
                ]);
            }

            // The IDs are explicit, so let Postgres' sequence catch up.
            if (DB::getDriverName() === 'pgsql') {
                DB::statement("SELECT setval(pg_get_serial_sequence('categories', 'id'), (SELECT MAX(id) FROM categories))");
            }
        });
    }
}
