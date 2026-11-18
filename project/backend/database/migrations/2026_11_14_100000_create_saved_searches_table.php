<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        // The same filters as GET /posts/query, null meaning "any"
        Schema::create('saved_searches', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->string('name', 50);
            $table->string('q', 100)->nullable();
            $table->string('type', 5)->nullable();
            // A search for a category that no longer exists would match everything
            $table->foreignId('category_id')->nullable()->constrained()->cascadeOnDelete();
            $table->timestamps();

            $table->unique(['user_id', 'name']);
            // Finding the searches a newly approved post could match
            $table->index(['type', 'category_id']);
        });

if (DB::connection()->getDriverName() === 'pgsql') {
    DB::statement("ALTER TABLE saved_searches ADD CONSTRAINT saved_searches_type_check CHECK (type IN ('lost', 'found'))");
} elseif (DB::connection()->getDriverName() === 'sqlite') {
    DB::unprepared(<<<'SQL'
        CREATE TRIGGER saved_searches_type_check_insert
        BEFORE INSERT ON saved_searches
        WHEN NEW.type IS NOT NULL AND NEW.type NOT IN ('lost', 'found')
        BEGIN
            SELECT RAISE(ABORT, 'saved_searches.type must be lost or found');
        END;
        SQL);

    DB::unprepared(<<<'SQL'
        CREATE TRIGGER saved_searches_type_check_update
        BEFORE UPDATE OF type ON saved_searches
        WHEN NEW.type IS NOT NULL AND NEW.type NOT IN ('lost', 'found')
        BEGIN
            SELECT RAISE(ABORT, 'saved_searches.type must be lost or found');
        END;
        SQL);
}
        // Which posts each saved search has already sent a notification for.
        // An edited post goes back to moderation and is approved again, this
        // keeps that from notifying twice.
        Schema::create('saved_search_matches', function (Blueprint $table) {
            $table->foreignId('saved_search_id')->constrained()->cascadeOnDelete();
            $table->foreignId('post_id')->index()->constrained()->cascadeOnDelete();
            $table->timestamp('created_at')->nullable();

            $table->primary(['saved_search_id', 'post_id']);
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('saved_search_matches');
        Schema::dropIfExists('saved_searches');
    }
};
