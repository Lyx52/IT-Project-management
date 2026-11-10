<?php

use App\Http\Controllers\Api\V1\PostController;
use App\Http\Controllers\Api\V1\RegisterController;
use Illuminate\Support\Facades\Route;

Route::prefix('v1')->group(function () {
    Route::post('/register', RegisterController::class)
        ->middleware('throttle:5,1');

    Route::get('/posts', [PostController::class, 'index']);
    Route::get('/post/{post}', [PostController::class, 'show'])->whereNumber('post');

    Route::middleware('auth:sanctum')->group(function () {
        Route::post('/posts', [PostController::class, 'store'])->middleware('throttle:10,1');
        Route::post('/post/{post}', [PostController::class, 'update'])->whereNumber('post');
        Route::delete('/post/{post}', [PostController::class, 'destroy'])->whereNumber('post');
    });
});
// Required for Registered event verification email generation (actual verification action is out of scope)
Route::get('/email/verify/{id}/{hash}', function () {
    // Placeholder route for verification email link generation
})->name('verification.verify');
