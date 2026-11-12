<?php

namespace App\Http\Middleware;

use App\Enums\CaptchaResult;
use App\Services\MathCaptcha;
use Closure;
use Illuminate\Http\Request;
use Illuminate\Validation\ValidationException;
use Symfony\Component\HttpFoundation\Response;

/**
 * Requires a solved math CAPTCHA (`captcha_id` + `captcha_answer`) before the
 * request reaches its controller.
 *
 * Runs before the FormRequest on purpose. A request without a solved CAPTCHA
 * gets only the CAPTCHA error, so a bot cannot use the "e-mail has already
 * been taken" message to find out who has an account.
 */
class VerifyCaptcha
{
    public function __construct(private readonly MathCaptcha $captcha) {}

    public function handle(Request $request, Closure $next): Response
    {
        $result = $this->captcha->verify(
            $request->input('captcha_id'),
            $request->input('captcha_answer'),
        );

        $message = match ($result) {
            CaptchaResult::Solved => null,
            CaptchaResult::Wrong => 'That answer is not correct. Try the new question.',
            CaptchaResult::Expired => 'The question expired. Answer the new one.',
        };

        if ($message !== null) {
            throw ValidationException::withMessages(['captcha_answer' => [$message]]);
        }

        return $next($request);
    }
}
