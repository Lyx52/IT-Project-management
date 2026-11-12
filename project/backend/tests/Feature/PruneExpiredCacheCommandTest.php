<?php

namespace Tests\Feature;

use App\Services\MathCaptcha;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Tests\TestCase;

class PruneExpiredCacheCommandTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();

        // The test suite runs on the array store; production uses the database
        config(['cache.default' => 'database']);
    }

    public function test_deletes_unanswered_challenges_once_they_expire(): void
    {
        app(MathCaptcha::class)->create();
        $this->assertSame(1, DB::table('cache')->count());

        $this->travel(config('captcha.ttl_seconds') + 1)->seconds();
        app(MathCaptcha::class)->create();

        $this->artisan('app:prune-expired-cache')->assertSuccessful();

        // Only the challenge that is still valid is left
        $this->assertSame(1, DB::table('cache')->count());
    }

    public function test_does_nothing_for_other_cache_stores(): void
    {
        config(['cache.default' => 'array']);

        $this->artisan('app:prune-expired-cache')
            ->expectsOutputToContain('nothing to prune')
            ->assertSuccessful();
    }

    public function test_is_scheduled(): void
    {
        $this->artisan('schedule:list')
            ->expectsOutputToContain('app:prune-expired-cache')
            ->assertSuccessful();
    }
}
