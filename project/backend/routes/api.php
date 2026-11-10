<?php

use App\Http\Controllers\Api\V1\PostController;
use App\Http\Controllers\Api\V1\RegisterController;
use App\Http\Controllers\Api\V1\ResendVerificationController;
use App\Http\Controllers\Api\V1\VerifyEmailController;
use Illuminate\Support\Facades\Route;

Route::prefix('v1')->group(function () {
    Route::post('/register', RegisterController::class)
        ->middleware('throttle:5,1');

    // Linked from the verification e-mail sent on registration
    Route::get('/email/verify/{id}/{hash}', VerifyEmailController::class)
        ->whereNumber('id')
        ->middleware(['signed', 'throttle:6,1'])
        ->name('verification.verify');

    Route::get('/posts', [PostController::class, 'index']);
    Route::get('/post/{post}', [PostController::class, 'show'])->whereNumber('post');

    Route::middleware('auth:sanctum')->group(function () {
        Route::post('/email/resend', ResendVerificationController::class)
            ->middleware('throttle:verification-resend');

        Route::post('/posts', [PostController::class, 'store'])->middleware(['verified', 'throttle:10,1']);
        Route::post('/post/{post}', [PostController::class, 'update'])->whereNumber('post');
        Route::delete('/post/{post}', [PostController::class, 'destroy'])->whereNumber('post');
    });
});
