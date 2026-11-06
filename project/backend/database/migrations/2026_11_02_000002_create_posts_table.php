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
        Schema::create('posts', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->index()->constrained()->cascadeOnDelete();
            $table->foreignId('category_id')->index()->constrained()->restrictOnDelete();
            $table->string('type', 5);
            $table->string('title', 100);
            $table->text('description');
            $table->decimal('latitude', 8, 5);
            $table->decimal('longitude', 8, 5);
            $table->string('location_name', 150)->nullable();
            $table->date('event_date');
            $table->string('status', 10)->default('pending');
            $table->timestamp('resolved_at')->nullable();
            $table->timestamps();

            $table->index(['latitude', 'longitude'], 'posts_map_index'); // map bounds
        });

        DB::statement("ALTER TABLE posts ADD CONSTRAINT posts_type_check CHECK (type IN ('lost', 'found'))");
        DB::statement("ALTER TABLE posts ADD CONSTRAINT posts_status_check CHECK (status IN ('pending', 'approved', 'rejected', 'resolved'))");
        DB::statement('ALTER TABLE posts ADD CONSTRAINT posts_latitude_check CHECK (latitude BETWEEN -90 AND 90)');
        DB::statement('ALTER TABLE posts ADD CONSTRAINT posts_longitude_check CHECK (longitude BETWEEN -180 AND 180)');
        // Listing filters
        DB::statement('CREATE INDEX posts_listing_index ON posts (status, type, event_date DESC)');

        Schema::create('post_images', function (Blueprint $table) {
            $table->id();
            $table->foreignId('post_id')->index()->constrained()->cascadeOnDelete();
            $table->string('path'); // private disk, random name, EXIF stripped
            $table->timestamps();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('post_images');
        Schema::dropIfExists('posts');
    }
};
