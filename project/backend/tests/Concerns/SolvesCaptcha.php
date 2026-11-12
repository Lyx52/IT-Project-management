<?php

namespace Tests\Concerns;

/**
 * Gets a challenge from GET /api/v1/captcha and works out the answer from the
 * question text, the same way a person would. Tests therefore go through the
 * real flow and never peek into the cache.
 */
trait SolvesCaptcha
{
    /**
     * @return array{captcha_id: string, captcha_answer: string, question: string}
     */
    protected function solvedCaptcha(): array
    {
        $challenge = $this->getJson('/api/v1/captcha')->assertOk()->json();

        return [
            'captcha_id' => $challenge['captcha_id'],
            'captcha_answer' => (string) $this->solve($challenge['question']),
            'question' => $challenge['question'],
        ];
    }

    protected function solve(string $question): int
    {
        $matched = preg_match('/^What is (\d+) ([+−]) (\d+)\?$/u', $question, $m);

        $this->assertSame(1, $matched, "Unexpected question format: {$question}");

        return $m[2] === '+' ? (int) $m[1] + (int) $m[3] : (int) $m[1] - (int) $m[3];
    }
}
