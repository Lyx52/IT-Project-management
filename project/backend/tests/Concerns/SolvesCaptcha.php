<?php

namespace Tests\Concerns;

/**
 * Gets a challenge from GET /api/v1/captcha and works out the answer the way
 * the client would: from the question, the matrix, or by brute force for the
 * hash puzzle. Tests therefore go through the real flow and never peek into
 * the cache. phpunit.xml shrinks CAPTCHA_MAX_NUMBER so hashing stays fast.
 */
trait SolvesCaptcha
{
    /**
     * @return array{captcha_id: string, captcha_answer: string}
     */
    protected function solvedCaptcha(): array
    {
        $challenge = $this->getJson('/api/v1/captcha')->assertOk()->json();

        return [
            'captcha_id' => $challenge['captcha_id'],
            'captcha_answer' => (string) $this->solve($challenge),
        ];
    }

    /**
     * @param  array<string, mixed>  $challenge
     */
    protected function solve(array $challenge): int
    {
        return match ($challenge['type']) {
            'math' => $this->solveMath($challenge['question']),
            'determinant' => $this->solveDeterminant($challenge['matrix']),
            'hash' => $this->solveHash($challenge),
        };
    }

    protected function solveMath(string $question): int
    {
        $matched = preg_match('/^What is (\d+) ([+−]) (\d+)\?$/u', $question, $m);

        $this->assertSame(1, $matched, "Unexpected question format: {$question}");

        return $m[2] === '+' ? (int) $m[1] + (int) $m[3] : (int) $m[1] - (int) $m[3];
    }

    /**
     * @param  array{array{int, int}, array{int, int}}  $matrix
     */
    protected function solveDeterminant(array $matrix): int
    {
        [[$a, $b], [$c, $d]] = $matrix;

        return $a * $d - $b * $c;
    }

    /**
     * @param  array{salt: string, challenge: string, max_number: int}  $challenge
     */
    protected function solveHash(array $challenge): int
    {
        for ($n = 0; $n <= $challenge['max_number']; $n++) {
            if (hash('sha256', $challenge['salt'].$n) === $challenge['challenge']) {
                return $n;
            }
        }

        $this->fail('No number in 0..max_number matches the challenge');
    }
}
