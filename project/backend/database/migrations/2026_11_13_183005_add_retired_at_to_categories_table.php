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
        Schema::table('categories', function (Blueprint $table) {
            $table->timestamp('retired_at')->nullable();
            $table->dropUnique('categories_name_unique');
        });

        DB::statement(
            'CREATE UNIQUE INDEX categories_name_lower_unique ON categories (LOWER(name))'
        );

        // Add the missing default, unless it already exists (ignoring case).
        $bicyclesExists = DB::table('categories')
            ->whereRaw('LOWER(name) = ?', ['bicycles'])
            ->exists();

        if (! $bicyclesExists) {
            DB::table('categories')->insert(['name' => 'Bicycles']);
        }
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        DB::statement('DROP INDEX IF EXISTS categories_name_lower_unique');

        Schema::table('categories', function (Blueprint $table) {
            $table->dropColumn('retired_at');
            $table->unique('name');
        });
    }
};
