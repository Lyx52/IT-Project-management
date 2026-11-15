<?php

namespace App\Services;

use App\Enums\CaptchaResult;
use App\Enums\CaptchaType;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Str;
use InvalidArgumentException;

/**
 * Sign-up CAPTCHA, no external service. CAPTCHA_TYPE picks one of three kinds
 * (see config/captcha.php):
 *
 * - math: a small sum or difference, "What is 7 + 5?".
 * - determinant: the determinant ad − bc of a 2×2 matrix [[a, b], [c, d]].
 * - hash: a proof-of-work puzzle. The server picks a secret whole number n in
 *   0..max_number and a random salt, and sends only the salt and
 *   SHA-256(salt . n). The browser finds n by trying every number in turn,
 *   so the work is bounded by max_number + 1 hashes.
 *
 * Whatever the kind, the answer is a whole number that lives only in the
 * cache, keyed by a random challenge id, so the client never sees it. A
 * challenge is removed on its first check, whether the answer was right or
 * not: a bot gets one guess per challenge, and a solved challenge cannot be
 * replayed for a second account.
 *
 * None of these stops a bot written for this site. math and determinant can be
 * read by a program as easily as by a person; hash makes every sign-up cost
 * CPU time, which together with the rate limits makes mass registration slow.
 */
class CaptchaService
{
    private const CACHE_PREFIX = 'captcha:';

    public function type(): CaptchaType
    {
        $value = strtolower(trim((string) config('captcha.type')));

        return CaptchaType::tryFrom($value) ?? throw new InvalidArgumentException(
            "CAPTCHA_TYPE must be one of math, hash or determinant, got \"{$value}\"."
        );
    }

    /**
     * A new challenge for the client. Always has `captcha_id`, `type` and
     * `expires_in`; the rest depends on the type.
     *
     * @return array<string, mixed>
     */
    public function create(): array
    {
        $type = $this->type();

        [$answer, $public] = match ($type) {
            CaptchaType::Math => $this->math(),
            CaptchaType::Hash => $this->hash(),
            CaptchaType::Determinant => $this->determinant(),
        };

        $id = (string) Str::uuid();
        $ttl = (int) config('captcha.ttl_seconds');

        Cache::put(self::CACHE_PREFIX.$id, $answer, $ttl);

        return ['captcha_id' => $id, 'type' => $type->value, ...$public, 'expires_in' => $ttl];
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

        // Accepts 12, "12", " 12 " and "-3", nothing else: no floats, no "1e1"
        if (is_int($answer)) {
            $answer = (string) $answer;
        }

        if (! is_string($answer) || preg_match('/^-?\d{1,16}$/', trim($answer)) !== 1) {
            return CaptchaResult::Wrong;
        }

        return (int) trim($answer) === (int) $expected
            ? CaptchaResult::Solved
            : CaptchaResult::Wrong;
    }

    /**
     * @return array{int, array{question: string}}
     */
    private function math(): array
    {
        $max = (int) config('captcha.math.max_operand');
        $a = random_int(1, $max);
        $b = random_int(1, $max);

        if (random_int(0, 1) === 1) {
            // Larger number first, so the answer is never negative
            [$a, $b] = [max($a, $b), min($a, $b)];

            return [$a - $b, ['question' => "What is {$a} − {$b}?"]];
        }

        return [$a + $b, ['question' => "What is {$a} + {$b}?"]];
    }

    /**
     * @return array{int, array{question: string, matrix: array{array{int, int}, array{int, int}}}}
     */
    private function determinant(): array
    {
        $max = (int) config('captcha.determinant.max_entry');
        [$a, $b, $c, $d] = [random_int(1, $max), random_int(1, $max), random_int(1, $max), random_int(1, $max)];

        return [$a * $d - $b * $c, [
            'question' => 'What is the determinant of this matrix?',
            'matrix' => [[$a, $b], [$c, $d]],
        ]];
    }

    /**
     * @return array{int, array{algorithm: string, salt: string, challenge: string, max_number: int}}
     */
    private function hash(): array
    {
        $max = (int) config('captcha.hash.max_number');
        $number = random_int(0, $max);

        // 24 hex characters: unguessable, and short enough that salt plus
        // number always fits one SHA-256 block on the client
        $salt = bin2hex(random_bytes(12));

        return [$number, [
            'algorithm' => 'SHA-256',
            'salt' => $salt,
            'challenge' => hash('sha256', $salt.$number),
            'max_number' => $max,
        ]];
    }
}
