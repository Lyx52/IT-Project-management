<?php

namespace Database\Seeders;

use App\Enums\PostStatus;
use App\Enums\PostType;
use App\Models\Category;
use App\Models\Post;
use App\Models\Report;
use App\Models\User;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;

/**
 * Ten posts covering the states the UI has to handle, plus a few reports so
 * the moderation queue has something in it.
 *
 * Safe to re-run: it removes the posts and users it made last time first.
 * Only touches its own demo_* accounts, never real ones.
 *
 *   php artisan db:seed --class=DemoPostsSeeder
 */
class DemoPostsSeeder extends Seeder
{
    /** Prefix that marks an account as belonging to this seeder. */
    private const DEMO_PREFIX = 'demo_';

    public function run(): void
    {
        $this->reset();

        $finder = $this->user('demo_finder', 'Honest finder');
        $loser = $this->user('demo_loser', 'Unlucky owner');
        $spammer = $this->user('demo_spammer', 'Banned spammer', banned: true);

        $admin = User::where('role', 'admin')->first();

        // 1. Pending with a photo: the main case for the approve tab.
        $this->post($loser, PostType::Lost, PostStatus::Pending, [
            'title' => 'Black leather wallet',
            'description' => 'Lost somewhere between the library and the bus stop. Contains a student card.',
            'category' => 'Wallets & Cards',
            'location_name' => 'Lielā iela 2, Jelgava',
        ], image: '#2f6f4f');

        // 2. Pending without a photo: the card's placeholder path.
        $this->post($finder, PostType::Found, PostStatus::Pending, [
            'title' => 'Set of keys with a red keyring',
            'description' => 'Found on a bench. Three keys and a small torch.',
            'category' => 'Keys',
            'location_name' => null,
        ]);

        // 3. Pending with text at the limits: layout stress for truncation.
        $this->post($loser, PostType::Lost, PostStatus::Pending, [
            'title' => str_repeat('Very long title to check how the card truncates ', 2),
            'description' => str_repeat('A deliberately long description. ', 40),
            'category' => 'Other',
            'location_name' => 'A very long location name that should also wrap somewhere sensible',
        ]);

        // 4. Approved with a photo: an ordinary feed card.
        $this->post($finder, PostType::Found, PostStatus::Approved, [
            'title' => 'iPhone 13 in a blue case',
            'description' => 'Handed in at the faculty reception. Screen is locked.',
            'category' => 'Phones',
            'location_name' => 'LBTU faculty building',
        ], image: '#2b5fa8', reviewer: $admin);

        // 5. Approved with no location: "Location not specified" in the card.
        $this->post($finder, PostType::Found, PostStatus::Approved, [
            'title' => 'Grey knitted scarf',
            'description' => 'No idea where this came from, it was on the floor.',
            'category' => 'Clothing',
            'location_name' => null,
        ], reviewer: $admin);

        // 6. Approved and reported once: hide / ban / dismiss in the reports tab.
        $reported = $this->post($spammer, PostType::Found, PostStatus::Approved, [
            'title' => 'FREE MONEY click here now',
            'description' => 'Totally legitimate offer, definitely not spam.',
            'category' => 'Other',
            'location_name' => 'Nowhere',
        ], image: '#a83b3b', reviewer: $admin);

        $this->report($reported, $loser, 'Obvious spam, nothing to do with lost property.');

        // 7. Approved with two reports: several reports on one post.
        $twiceReported = $this->post($spammer, PostType::Lost, PostStatus::Approved, [
            'title' => 'Lost my dignity, reward offered',
            'description' => 'Offensive rambling that several people flagged.',
            'category' => 'Other',
            'location_name' => 'Jelgava',
        ], reviewer: $admin);

        $this->report($twiceReported, $loser, 'Offensive language.');
        $this->report($twiceReported, $finder, 'Not a real lost item, this is abuse.');

        // 8. Resolved: can still be taken down, so worth having in the data.
        $this->post($finder, PostType::Found, PostStatus::Resolved, [
            'title' => 'Silver bicycle, returned to owner',
            'description' => 'Reunited with the owner last week.',
            'category' => 'Other',
            'location_name' => 'Pasta iela',
        ], image: '#6b4fa8', reviewer: $admin);

        // 9. Rejected: must NOT appear in the public feed.
        $this->post($spammer, PostType::Lost, PostStatus::Rejected, [
            'title' => 'Rejected submission, should be invisible',
            'description' => 'If you can see this in the feed, the status filter is broken.',
            'category' => 'Other',
            'location_name' => 'Hidden',
        ], reviewer: $admin);

        // 10. Approved but written by a banned user.
        $this->post($spammer, PostType::Found, PostStatus::Approved, [
            'title' => 'Posted before the author was banned',
            'description' => 'Checks what happens to a banned user\'s existing posts.',
            'category' => 'Documents',
            'location_name' => 'Riga',
        ], reviewer: $admin);

        $this->command?->info('Seeded 10 demo posts and 3 reports.');
        $this->command?->info('Demo accounts: demo_finder / demo_loser / demo_spammer (banned), password "password".');
    }

    /** Removes what a previous run created, so this can be run repeatedly. */
    private function reset(): void
    {
        $demoIds = User::where('username', 'like', self::DEMO_PREFIX.'%')->pluck('id');

        if ($demoIds->isEmpty()) {
            return;
        }

        foreach (Post::whereIn('user_id', $demoIds)->get() as $post) {
            Storage::disk('public')->deleteDirectory("posts/{$post->id}");
        }

        // Reports and images cascade from the posts, posts cascade from users.
        User::whereIn('id', $demoIds)->forceDelete();
    }

    private function user(string $username, string $label, bool $banned = false): User
    {
        $user = User::create([
            'username' => $username,
            'email' => $username.'@example.com',
            'password' => 'password',
            'terms_accepted_at' => now(),
            'privacy_policy_version' => '1.0',
        ]);

        // role, banned_at and verification are deliberately not mass assignable.
        $user->forceFill([
            'email_verified_at' => now(),
            'banned_at' => $banned ? now() : null,
        ])->save();

        $this->command?->line("  {$label}: {$username}");

        return $user;
    }

    /**
     * @param  array<string, mixed>  $attributes
     */
    private function post(
        User $author,
        PostType $type,
        PostStatus $status,
        array $attributes,
        ?string $image = null,
        ?User $reviewer = null,
    ): Post {
        $post = Post::create([
            'user_id' => $author->id,
            'category_id' => Category::where('name', $attributes['category'])->value('id'),
            'type' => $type,
            'title' => Str::limit($attributes['title'], 100, ''),
            'description' => $attributes['description'],
            'latitude' => 56.9496,
            'longitude' => 24.1052,
            'location_name' => $attributes['location_name'],
            'event_date' => now()->subDays(random_int(1, 20))->format('Y-m-d'),
            'status' => $status,
        ]);

        if ($reviewer !== null && $status !== PostStatus::Pending) {
            $post->forceFill([
                'reviewed_by' => $reviewer->id,
                'reviewed_at' => now()->subDays(random_int(0, 3)),
            ])->save();
        }

        if ($status === PostStatus::Resolved) {
            // Backdate the creation too, otherwise the post looks resolved
            // before it existed and the average-days figure goes negative.
            $post->forceFill([
                'created_at' => now()->subDays(9),
                'resolved_at' => now()->subDays(2),
            ])->save();
        }

        if ($image !== null) {
            $this->attachImage($post, $image);
        }

        return $post;
    }

    /** Draws a plain placeholder so the card has a real, servable image. */
    private function attachImage(Post $post, string $hexColour): void
    {
        [$red, $green, $blue] = sscanf($hexColour, '#%02x%02x%02x');

        $canvas = imagecreatetruecolor(600, 400);
        imagefill($canvas, 0, 0, imagecolorallocate($canvas, $red, $green, $blue));
        imagestring(
            $canvas,
            5,
            20,
            20,
            substr($post->title, 0, 60),
            imagecolorallocate($canvas, 255, 255, 255),
        );

        ob_start();
        imagepng($canvas);
        $bytes = (string) ob_get_clean();
        imagedestroy($canvas);

        $path = "posts/{$post->id}/".Str::uuid().'.png';
        Storage::disk('public')->put($path, $bytes);

        $post->images()->create(['path' => $path]);
    }

    private function report(Post $post, User $reporter, string $reason): void
    {
        Report::create([
            'post_id' => $post->id,
            'reporter_id' => $reporter->id,
            'reason' => $reason,
            'status' => 'open',
        ]);
    }
}
