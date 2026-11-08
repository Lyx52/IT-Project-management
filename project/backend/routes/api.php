<?php

use App\Http\Controllers\Api\V1\RegisterController;
use Illuminate\Support\Facades\Route;

Route::prefix('v1')->group(function () {
    Route::post('/register', RegisterController::class)
        ->middleware('throttle:5,1');
});
// Required for Registered event verification email generation (actual verification action is out of scope)
Route::get('/email/verify/{id}/{hash}', function () {
    // Placeholder route for verification email link generation
})->name('verification.verify');