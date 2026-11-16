<?php

namespace App\Http\Middleware;

use App\Enums\CaptchaResult;
use App\Services\CaptchaService;
use Closure;
use Illuminate\Http\Request;
use Illuminate\Validation\ValidationException;
use Symfony\Component\HttpFoundation\Response;

/**
 * Requires a solved CAPTCHA (`captcha_id` + `captcha_answer`) before the
 * request reaches its controller.
 *
 * Runs before the FormRequest on purpose. A request without a solved CAPTCHA
 * gets only the CAPTCHA error, so a bot cannot use the "e-mail has already
 * been taken" message to find out who has an account.
 */
class VerifyCaptcha
{
    public function __construct(private readonly CaptchaService $captcha) {}

    public function handle(Request $request, Closure $next): Response
    {
        $result = $this->captcha->verify(
            $request->input('captcha_id'),
            $request->input('captcha_answer'),
        );

        // Typed-in answers get told about the new question; a hash puzzle the
        // browser solved by itself is simply redone
        $asksUser = $this->captcha->type()->asksUser();

        $message = match ($result) {
            CaptchaResult::Solved => null,
            CaptchaResult::Wrong => $asksUser
                ? 'That answer is not correct. Try the new question.'
                : 'The security check failed. Please try again.',
            CaptchaResult::Expired => $asksUser
                ? 'The question expired. Answer the new one.'
                : 'The security check expired. Please try again.',
        };

        if ($message !== null) {
            throw ValidationException::withMessages(['captcha_answer' => [$message]]);
        }

        return $next($request);
    }
}
