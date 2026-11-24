<?php

use App\Http\Controllers\Api\V1\Admin\PostModerationController;
use App\Http\Controllers\Api\V1\Admin\ReportController as AdminReportController;
use App\Http\Controllers\Api\V1\Admin\StatisticsController;
use App\Http\Controllers\Api\V1\Admin\UserBanController;
use App\Http\Controllers\Api\V1\Admin\UserController as AdminUserController;
use App\Http\Controllers\Api\V1\CaptchaController;
use App\Http\Controllers\Api\V1\CategoryController;
use App\Http\Controllers\Api\V1\CurrentUserController;
use App\Http\Controllers\Api\V1\DeleteAccountController;
use App\Http\Controllers\Api\V1\LoginController;
use App\Http\Controllers\Api\V1\LogoutController;
use App\Http\Controllers\Api\V1\MessageAttachmentController;
use App\Http\Controllers\Api\V1\MessageController;
use App\Http\Controllers\Api\V1\MyPostsController;
use App\Http\Controllers\Api\V1\NotificationController;
use App\Http\Controllers\Api\V1\PostController;
use App\Http\Controllers\Api\V1\RegisterController;
use App\Http\Controllers\Api\V1\ReportPostController;
use App\Http\Controllers\Api\V1\ResendVerificationController;
use App\Http\Controllers\Api\V1\SavedSearchController;
use App\Http\Controllers\Api\V1\UserDataExportController;
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
        ->middleware('throttle:login');
    // Protected Auth Routes
    Route::middleware('auth:sanctum')->group(function () {
        Route::post('/logout', LogoutController::class);
        Route::get('/user', CurrentUserController::class);
        Route::get('/user/export', UserDataExportController::class);
        Route::get('/user/posts', MyPostsController::class);
        Route::delete('/user', DeleteAccountController::class);
    });

    // Linked from the verification e-mail sent on registration
    Route::get('/email/verify/{id}/{hash}', VerifyEmailController::class)
        ->whereNumber('id')
        ->middleware(['signed', 'throttle:6,1'])
        ->name('verification.verify');

    // The link in each message attachment: signed and expiring, because an
    // <img>/<video> tag can't send the bearer token
    Route::get('/message-attachments/{attachment}', [MessageAttachmentController::class, 'show'])
        ->whereNumber('attachment')
        ->middleware(['signed', 'throttle:120,1'])
        ->name('message-attachments.show');

    Route::get('/category/query', [CategoryController::class, 'query']);

    Route::get('/posts', [PostController::class, 'index']);
    Route::get('/posts/query', [PostController::class, 'search'])->middleware('throttle:60,1');
    Route::get('/post/{post}', [PostController::class, 'show'])->whereNumber('post');

    Route::middleware('auth:sanctum')->group(function () {
        Route::post('/email/resend', ResendVerificationController::class)
            ->middleware('throttle:verification-resend');

        Route::post('/posts', [PostController::class, 'store'])->middleware(['verified', 'throttle:10,1']);
        Route::get('/post/{post}/matches', [PostController::class, 'matches'])->whereNumber('post');
        Route::post('/post/{post}', [PostController::class, 'update'])->whereNumber('post');
        Route::post('/post/{post}/resolve', [PostController::class, 'resolve'])->whereNumber('post');
        Route::get('/messages/conversations', [MessageController::class, 'conversations']);
        Route::get('/post/{post}/messages', [MessageController::class, 'index'])->whereNumber('post');
        Route::post('/post/{post}/messages', [MessageController::class, 'store'])
            ->whereNumber('post')
            ->middleware(['verified', 'throttle:30,1']);
        Route::post('/post/{post}/report', ReportPostController::class)
            ->whereNumber('post')
            ->middleware('throttle:10,1');
        Route::delete('/post/{post}', [PostController::class, 'destroy'])->whereNumber('post');

        Route::get('/saved-searches', [SavedSearchController::class, 'index']);
        Route::post('/saved-searches', [SavedSearchController::class, 'store'])->middleware('throttle:20,1');
        Route::patch('/saved-search/{savedSearch}', [SavedSearchController::class, 'update'])->whereNumber('savedSearch');
        Route::delete('/saved-search/{savedSearch}', [SavedSearchController::class, 'destroy'])->whereNumber('savedSearch');

        Route::get('/notifications', [NotificationController::class, 'index']);
        Route::post('/notifications/read', [NotificationController::class, 'readAll']);
        Route::post('/notification/{notification}/read', [NotificationController::class, 'read'])->whereUuid('notification');
    });

    // Admin Moderation Routes
    Route::middleware(['auth:sanctum', EnsureUserIsAdmin::class])
        ->prefix('admin')
        ->group(function () {
            Route::get('/statistics', StatisticsController::class);
            Route::post('/users/{user}/ban', [UserBanController::class, 'ban'])->whereNumber('user');
            Route::post('/users/{user}/unban', [UserBanController::class, 'unban'])->whereNumber('user');
            Route::get('/users', [AdminUserController::class, 'index']);
            Route::get('/moderation/queue', [PostModerationController::class, 'queue']);
            Route::post('/posts/{post}/approve', [PostModerationController::class, 'approve'])->whereNumber('post');
            Route::post('/posts/{post}/reject', [PostModerationController::class, 'reject'])->whereNumber('post');
            Route::post('/posts/{post}/takedown', [PostModerationController::class, 'takedown'])->whereNumber('post');
            Route::post('/reports/{report}/close', [AdminReportController::class, 'close'])->whereNumber('report');
            Route::get('/categories', [CategoryController::class, 'adminIndex']);
            Route::post('/categories', [CategoryController::class, 'store']);
            Route::patch('/categories/{category}', [CategoryController::class, 'update'])->whereNumber('category');
            Route::post('/categories/{category}/retire', [CategoryController::class, 'retire'])->whereNumber('category');
            Route::post('/categories/{category}/restore', [CategoryController::class, 'restore'])->whereNumber('category');
            Route::delete('/categories/{category}', [CategoryController::class, 'destroy'])->whereNumber('category');
        });
});
