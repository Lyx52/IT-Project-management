<?php

namespace Tests\Feature;

use App\Models\Category;
use App\Models\Post;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Tests\TestCase;

class PostSearchTest extends TestCase
{
    use RefreshDatabase;

    private Category $keys;

    protected function setUp(): void
    {
        parent::setUp();
        $this->keys = Category::firstOrCreate(['name' => 'Keys']);
    }

    private function createPost(array $attributes = []): Post
    {
        return Post::factory()->approved()->create([
            'category_id' => $this->keys->id,
            'title' => 'Something',
            'description' => 'Nothing to see here',
            ...$attributes,
        ]);
    }

    /**
     * @return list<int>
     */
    private function search(array $query): array
    {
        return $this->getJson('/api/v1/posts/query?'.http_build_query($query))
            ->assertOk()
            ->json('data.*.id');
    }

    public function test_matches_words_in_the_title_or_description(): void
    {
        $byTitle = $this->createPost(['title' => 'Lost car keys']);
        $byDescription = $this->createPost(['description' => 'Blue keyring with three keys']);
        $this->createPost(['title' => 'Black wallet']);

        $this->assertEqualsCanonicalizing([$byTitle->id, $byDescription->id], $this->search(['q' => 'keys']));
    }

    public function test_is_case_insensitive(): void
    {
        $post = $this->createPost(['title' => 'Samsung Phone']);

        $this->assertSame([$post->id], $this->search(['q' => 'sAMSUNG phONE']));
    }

    public function test_ignores_diacritics_both_ways(): void
    {
        $accented = $this->createPost(['title' => 'Pazaudētas atslēgas']);
        $plain = $this->createPost(['title' => 'Atrasts telefons pie Zalkalna']);

        $this->assertSame([$accented->id], $this->search(['q' => 'atslegas']));
        $this->assertSame([$plain->id], $this->search(['q' => 'Žalkalna']));
    }

    public function test_every_word_must_match(): void
    {
        $both = $this->createPost(['title' => 'Red umbrella', 'description' => 'Left on the bus']);
        $this->createPost(['title' => 'Red scarf']);

        $this->assertSame([$both->id], $this->search(['q' => 'red  bus ']));
    }

    public function test_wildcards_are_matched_literally(): void
    {
        $this->createPost(['title' => 'Black wallet']);
        $percent = $this->createPost(['title' => '100% wool hat']);

        $this->assertSame([], $this->search(['q' => '_']));
        $this->assertSame([$percent->id], $this->search(['q' => '%']));
    }

    public function test_without_q_returns_the_public_feed(): void
    {
        $older = $this->createPost(['created_at' => now()->subDay()]);
        $newer = $this->createPost();

        $this->assertSame([$newer->id, $older->id], $this->search([]));
    }

    public function test_only_returns_approved_posts_from_unbanned_users(): void
    {
        $visible = $this->createPost(['title' => 'Keys']);
        foreach ([Post::factory(), Post::factory()->rejected(), Post::factory()->resolved()] as $factory) {
            $factory->create(['category_id' => $this->keys->id, 'title' => 'Keys']);
        }
        $banned = User::factory()->create();
        $banned->forceFill(['banned_at' => now()])->save();
        $this->createPost(['title' => 'Keys', 'user_id' => $banned->id]);

        $this->assertSame([$visible->id], $this->search(['q' => 'keys']));
    }

    public function test_rejects_an_overlong_query(): void
    {
        $this->getJson('/api/v1/posts/query?q='.str_repeat('a', 101))->assertUnprocessable()->assertJsonValidationErrors('q');
    }

    public function test_pagination_links_keep_the_query(): void
    {
        Post::factory()->approved()->count(21)->create(['category_id' => $this->keys->id, 'title' => 'Keys']);

        $next = $this->getJson('/api/v1/posts/query?q=keys')->assertOk()->json('links.next');

        $this->assertStringContainsString('q=keys', $next);
    }

    public function test_answers_well_under_two_seconds_on_a_few_thousand_posts(): void
    {
        $user = User::factory()->create();
        DB::statement(<<<'SQL'
            INSERT INTO posts (user_id, category_id, type, title, description, latitude, longitude, event_date, status, created_at, updated_at)
            SELECT ?, ?, CASE WHEN n % 2 = 0 THEN 'lost' ELSE 'found' END,
                   'Pazaudēts priekšmets ' || n, 'Apraksts numur ' || n || ' ar garumzīmēm āčēģīķļņšūž',
                   56.9, 24.1, CURRENT_DATE, 'approved', NOW(), NOW()
            FROM generate_series(1, 5000) AS n
            SQL, [$user->id, $this->keys->id]);

        $start = microtime(true);
        $this->getJson('/api/v1/posts/query?q=pazaudets+garumzimem')->assertOk()->assertJsonCount(20, 'data');

        $this->assertLessThan(2.0, microtime(true) - $start);
    }
}
