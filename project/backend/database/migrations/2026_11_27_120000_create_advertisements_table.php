<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('advertisements', function (Blueprint $table) {
            $table->id();
            $table->string('advertiser', 120);
            $table->string('title', 120);
            $table->text('description');
            $table->string('target_url', 2048);
            $table->foreignId('category_id')->nullable()->constrained()->nullOnDelete();
            $table->string('status', 10)->default('pending');
            $table->foreignId('reviewed_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamp('reviewed_at')->nullable();
            $table->timestamps();

            $table->index(['status', 'category_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('advertisements');
    }
};
