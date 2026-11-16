<?php

namespace App\Enums;

/**
 * The kind of CAPTCHA GET /api/v1/captcha hands out, chosen with CAPTCHA_TYPE
 * (config/captcha.php).
 */
enum CaptchaType: string
{
    /** "What is 7 + 5?", typed in by the user. */
    case Math = 'math';

    /** A SHA-256 proof-of-work puzzle the browser solves by itself. */
    case Hash = 'hash';

    /** The determinant of a 2×2 matrix, typed in by the user. */
    case Determinant = 'determinant';

    /** Whether the user types the answer, as opposed to the browser finding it. */
    public function asksUser(): bool
    {
        return $this !== self::Hash;
    }
}
