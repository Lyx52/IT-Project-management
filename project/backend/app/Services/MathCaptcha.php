<?php

namespace App\Services;

use App\Enums\CaptchaResult;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Str;

/**
 * Lightweight arithmetic CAPTCHA, no external service.
 *
 * The answer lives only in the cache, keyed by a random challenge id, so the
 * client never sees it. A challenge is removed on its first check, whether the
 * answer was right or not: a bot gets one guess per challenge, and a solved
 * challenge cannot be replayed for a second account.
 *
 * This keeps out generic form-spamming bots. It does not stop a bot written
 * for this site, which can read the question as easily as a person can.
 */
class MathCaptcha
{
    private const CACHE_PREFIX = 'captcha:';

    /**
     * @return array{captcha_id: string, question: string, expires_in: int}
     */
    public function create(): array
    {
        $max = (int) config('captcha.max_operand');
        $a = random_int(1, $max);
        $b = random_int(1, $max);

        if (random_int(0, 1) === 1) {
            // Larger number first, so the answer is never negative
            [$a, $b] = [max($a, $b), min($a, $b)];
            $question = "What is {$a} − {$b}?";
            $answer = $a - $b;
        } else {
            $question = "What is {$a} + {$b}?";
            $answer = $a + $b;
        }

        $id = (string) Str::uuid();
        $ttl = (int) config('captcha.ttl_seconds');

        Cache::put(self::CACHE_PREFIX.$id, $answer, $ttl);

        return [
            'captcha_id' => $id,
            'question' => $question,
            'expires_in' => $ttl,
        ];
    }

    /**
     * Checks an answer and uses up the challenge, whatever the outcome.
     */
    public function verify(mixed $id, mixed $answer): CaptchaResult
    {
        if (! is_string($id) || ! Str::isUuid($id)) {
            return CaptchaResult::Expired;
        }

        $expected = Cache::pull(self::CACHE_PREFIX.$id);

        if ($expected === null) {
            return CaptchaResult::Expired;
        }

        // Accepts 12 and "12" (and " 12 "), nothing else: no floats, no "1e1"
        if (is_int($answer)) {
            $answer = (string) $answer;
        }

        if (! is_string($answer) || preg_match('/^-?\d{1,6}$/', trim($answer)) !== 1) {
            return CaptchaResult::Wrong;
        }

        return (int) trim($answer) === (int) $expected
            ? CaptchaResult::Solved
            : CaptchaResult::Wrong;
    }
}
