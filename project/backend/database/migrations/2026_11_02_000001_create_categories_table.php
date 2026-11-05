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
        Schema::create('categories', function (Blueprint $table) {
            $table->id();
            $table->string('name', 50)->unique();
        });

        // Reference data, inserted here so it exists without running db:seed
        DB::table('categories')->insert(array_map(fn ($name) => ['name' => $name], [
            'Phones', 'Keys', 'Wallets & Cards', 'Bags', 'Documents',
            'Electronics', 'Jewellery', 'Clothing', 'Pets', 'Other',
        ]));
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('categories');
    }
};
