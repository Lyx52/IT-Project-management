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
        Schema::create('messages', function (Blueprint $table) {
            $table->id();
            $table->foreignId('sender_id')->constrained('users')->cascadeOnDelete();
            $table->foreignId('receiver_id')->constrained('users')->cascadeOnDelete();
            $table->foreignId('post_id')->nullable()->index()->constrained()->nullOnDelete();
            $table->text('body')->nullable(); // encrypted cast
            $table->string('file_path')->nullable(); // private disk
            $table->string('media_type', 5)->nullable();
            $table->timestamp('read_at')->nullable();
            $table->timestamps();

            $table->index(['sender_id', 'receiver_id', 'created_at'], 'messages_conversation_index');
        });

        DB::statement('ALTER TABLE messages ADD CONSTRAINT messages_sender_receiver_check CHECK (sender_id <> receiver_id)');
        DB::statement('ALTER TABLE messages ADD CONSTRAINT messages_content_check CHECK (body IS NOT NULL OR file_path IS NOT NULL)');
        DB::statement("ALTER TABLE messages ADD CONSTRAINT messages_media_type_check CHECK (media_type IN ('image', 'video'))");
        DB::statement('ALTER TABLE messages ADD CONSTRAINT messages_file_media_check CHECK ((file_path IS NULL) = (media_type IS NULL))');
        DB::statement('CREATE INDEX messages_unread_index ON messages (receiver_id) WHERE read_at IS NULL');
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('messages');
    }
};
