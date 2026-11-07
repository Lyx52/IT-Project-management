<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Tests\TestCase;

class UserPruningTest extends TestCase
{
    use RefreshDatabase;

    /**
     * AC-17: worst case, a deleted account's data lives on for the purge delay,
     * one day until the daily prune, the backup retention and one day until
     * Oracle's daily lifecycle run. See config/retention.php.
     */
    public function test_purge_delay_and_backup_retention_fit_the_deletion_limit(): void
    {
        $worstCase = config('retention.account_purge_days') + 1
            + config('retention.backup_retention_days') + 1;

        $this->assertLessThanOrEqual(config('retention.deleted_account_limit_days'), $worstCase);
    }

    public function test_prune_permanently_deletes_accounts_past_the_purge_delay_with_their_data_and_files(): void
    {
        Storage::fake('local');
        $days = config('retention.account_purge_days');

        $due = User::factory()->create(['avatar_path' => 'avatars/due.jpg']);
        $recent = User::factory()->create();
        $other = User::factory()->create();

        $post = DB::table('posts')->insertGetId([
            'user_id' => $due->id,
            'category_id' => DB::table('categories')->value('id'),
            'type' => 'lost',
            'title' => 'Keys',
            'description' => 'Lost my keys',
            'latitude' => 56.95,
            'longitude' => 24.1,
            'event_date' => now()->toDateString(),
            'created_at' => now(),
            'updated_at' => now(),
        ]);
        DB::table('post_images')->insert(['post_id' => $post, 'path' => 'posts/keys.jpg', 'created_at' => now(), 'updated_at' => now()]);

        // One message each way, both carry an attachment
        foreach ([[$due, $other, 'sent.jpg'], [$other, $due, 'received.jpg']] as [$from, $to, $file]) {
            $message = DB::table('messages')->insertGetId([
                'sender_id' => $from->id,
                'receiver_id' => $to->id,
                'body' => 'hello',
                'created_at' => now(),
                'updated_at' => now(),
            ]);
            DB::table('message_attachments')->insert([
                'message_id' => $message,
                'path' => "attachments/$file",
                'mime_type' => 'image/jpeg',
                'size' => 1,
                'created_at' => now(),
                'updated_at' => now(),
            ]);
        }

        $files = ['avatars/due.jpg', 'posts/keys.jpg', 'attachments/sent.jpg', 'attachments/received.jpg'];
        foreach ($files as $file) {
            Storage::disk('local')->put($file, 'x');
        }

        $this->travelTo(now()->subDays($days)->subMinute(), fn () => $due->delete());
        $this->travelTo(now()->subDays($days)->addHour(), fn () => $recent->delete());

        $this->artisan('model:prune', ['--model' => [User::class]])->assertSuccessful();

        $this->assertNull(User::withTrashed()->find($due->id), 'deleted more than the purge delay ago');
        $this->assertNotNull(User::withTrashed()->find($recent->id), 'still within the purge delay');
        $this->assertNotNull(User::find($other->id), 'not deleted at all');

        $this->assertDatabaseCount('posts', 0);
        $this->assertDatabaseCount('post_images', 0);
        $this->assertDatabaseCount('messages', 0);
        $this->assertDatabaseCount('message_attachments', 0);
        foreach ($files as $file) {
            Storage::disk('local')->assertMissing($file);
        }
    }

    public function test_purge_delay_is_configurable(): void
    {
        config(['retention.account_purge_days' => 5]);
        $user = User::factory()->create();
        $this->travelTo(now()->subDays(6), fn () => $user->delete());

        $this->artisan('model:prune', ['--model' => [User::class]])->assertSuccessful();

        $this->assertNull(User::withTrashed()->find($user->id));
    }
}
