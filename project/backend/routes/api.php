<?php

use App\Http\Controllers\Api\V1\Admin\UserBanController;
use App\Http\Controllers\Api\V1\CaptchaController;
use App\Http\Controllers\Api\V1\CurrentUserController;
use App\Http\Controllers\Api\V1\LoginController;
use App\Http\Controllers\Api\V1\LogoutController;
use App\Http\Controllers\Api\V1\MessageController;
use App\Http\Controllers\Api\V1\PostController;
use App\Http\Controllers\Api\V1\RegisterController;
use App\Http\Controllers\Api\V1\ReportPostController;
use App\Http\Controllers\Api\V1\ResendVerificationController;
use App\Http\Controllers\Api\V1\VerifyEmailController;
use App\Http\Middleware\EnsureUserIsAdmin;
use Illuminate\Support\Facades\Route;

Route::prefix('v1')->group(function () {
    // Public Auth Routes
    Route::get('/captcha', CaptchaController::class)
        ->middleware('throttle:30,1');
    Route::post('/register', RegisterController::class)
        ->middleware(['throttle:5,1', 'captcha']);
    Route::post('/login', LoginController::class)
        ->middleware('throttle:5,1');
    // Protected Auth Routes
    Route::middleware('auth:sanctum')->group(function () {
        Route::post('/logout', LogoutController::class);
        Route::get('/user', CurrentUserController::class);
    });

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
        Route::post('/post/{post}/resolve', [PostController::class, 'resolve'])->whereNumber('post');
        Route::get('/post/{post}/messages', [MessageController::class, 'index'])->whereNumber('post');
        Route::post('/post/{post}/messages', [MessageController::class, 'store'])
            ->whereNumber('post')
            ->middleware(['verified', 'throttle:30,1']);
        Route::post('/post/{post}/report', ReportPostController::class)
            ->whereNumber('post')
            ->middleware('throttle:10,1');
        Route::delete('/post/{post}', [PostController::class, 'destroy'])->whereNumber('post');
    });

    // Admin Moderation Routes
    Route::middleware(['auth:sanctum', EnsureUserIsAdmin::class])
        ->prefix('admin')
        ->group(function () {
            Route::post('/users/{user}/ban', [UserBanController::class, 'ban'])->whereNumber('user');
            Route::post('/users/{user}/unban', [UserBanController::class, 'unban'])->whereNumber('user');
        });
});
