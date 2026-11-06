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
        Schema::create('message_attachments', function (Blueprint $table) {
            $table->id();
            $table->foreignId('message_id')->index()->constrained()->cascadeOnDelete();
            $table->string('path'); // private disk, random name, EXIF stripped
            $table->string('mime_type'); // detected server-side, not the client header
            $table->unsignedInteger('size'); // bytes
            $table->timestamps();
        });

        DB::statement("ALTER TABLE message_attachments ADD CONSTRAINT message_attachments_mime_type_check CHECK (mime_type LIKE 'image/%' OR mime_type LIKE 'video/%')");
        DB::statement('ALTER TABLE message_attachments ADD CONSTRAINT message_attachments_size_check CHECK (size > 0)');

        // A message with only attachments has no body, and a CHECK can't look at
        // another table, so "body or at least one attachment" is validated in the app.
        DB::statement('ALTER TABLE messages DROP CONSTRAINT messages_content_check');
        DB::statement('ALTER TABLE messages DROP CONSTRAINT messages_file_media_check');
        DB::statement('ALTER TABLE messages DROP CONSTRAINT messages_media_type_check');

        Schema::table('messages', function (Blueprint $table) {
            $table->dropColumn(['file_path', 'media_type']);
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('messages', function (Blueprint $table) {
            $table->string('file_path')->nullable();
            $table->string('media_type', 5)->nullable();
        });

        Schema::dropIfExists('message_attachments');

        // Attachment rows are lost, so attachment-only messages have no content left
        // and would break the restored content check.
        DB::statement('DELETE FROM messages WHERE body IS NULL');

        DB::statement('ALTER TABLE messages ADD CONSTRAINT messages_content_check CHECK (body IS NOT NULL OR file_path IS NOT NULL)');
        DB::statement("ALTER TABLE messages ADD CONSTRAINT messages_media_type_check CHECK (media_type IN ('image', 'video'))");
        DB::statement('ALTER TABLE messages ADD CONSTRAINT messages_file_media_check CHECK ((file_path IS NULL) = (media_type IS NULL))');
    }
};
