<?php

namespace Tests\Feature;

use App\Enums\CaptchaResult;
use App\Services\MathCaptcha;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\Concerns\SolvesCaptcha;
use Tests\TestCase;

class CaptchaTest extends TestCase
{
    use RefreshDatabase, SolvesCaptcha;

    private function captcha(): MathCaptcha
    {
        return app(MathCaptcha::class);
    }

    public function test_hands_out_a_question_with_an_id_and_lifetime(): void
    {
        $response = $this->getJson('/api/v1/captcha')->assertOk();

        $response->assertJsonStructure(['captcha_id', 'question', 'expires_in'])
            ->assertJsonPath('expires_in', config('captcha.ttl_seconds'))
            ->assertHeader('Cache-Control', 'no-store, private');

        $this->assertMatchesRegularExpression('/^What is \d+ [+−] \d+\?$/u', $response->json('question'));
    }

    public function test_never_sends_the_answer_to_the_client(): void
    {
        $body = $this->getJson('/api/v1/captcha')->assertOk()->json();

        $this->assertSame(['captcha_id', 'question', 'expires_in'], array_keys($body));
    }

    public function test_hands_out_a_different_challenge_each_time(): void
    {
        $first = $this->getJson('/api/v1/captcha')->json('captcha_id');
        $second = $this->getJson('/api/v1/captcha')->json('captcha_id');

        $this->assertNotSame($first, $second);
    }

    public function test_asks_both_additions_and_subtractions_and_never_a_negative_answer(): void
    {
        $operators = [];

        for ($i = 0; $i < 200; $i++) {
            $question = $this->captcha()->create()['question'];
            preg_match('/^What is (\d+) ([+−]) (\d+)\?$/u', $question, $m);

            $operators[$m[2]] = true;
            $this->assertGreaterThanOrEqual(1, (int) $m[1]);
            $this->assertLessThanOrEqual(config('captcha.max_operand'), (int) $m[3]);
            $this->assertGreaterThanOrEqual(0, $this->solve($question));
        }

        // Odds of a false failure: 2^-199
        ksort($operators);
        $this->assertSame(['+', '−'], array_keys($operators));
    }

    public function test_accepts_the_right_answer_as_string_or_number(): void
    {
        $asString = $this->solvedCaptcha();
        $asNumber = $this->solvedCaptcha();

        $this->assertSame(CaptchaResult::Solved, $this->captcha()->verify($asString['captcha_id'], " {$asString['captcha_answer']} "));
        $this->assertSame(CaptchaResult::Solved, $this->captcha()->verify($asNumber['captcha_id'], (int) $asNumber['captcha_answer']));
    }

    public function test_rejects_a_wrong_answer(): void
    {
        $captcha = $this->solvedCaptcha();

        $this->assertSame(
            CaptchaResult::Wrong,
            $this->captcha()->verify($captcha['captcha_id'], (string) ((int) $captcha['captcha_answer'] + 1)),
        );
    }

    public function test_rejects_answers_that_are_not_whole_numbers(): void
    {
        foreach (['', 'twelve', '1e1', '12.0', '0x0c', null, [12], 12.0] as $answer) {
            $captcha = $this->solvedCaptcha();

            $this->assertSame(CaptchaResult::Wrong, $this->captcha()->verify($captcha['captcha_id'], $answer));
        }
    }

    public function test_a_challenge_cannot_be_reused_after_a_correct_answer(): void
    {
        $captcha = $this->solvedCaptcha();

        $this->assertSame(CaptchaResult::Solved, $this->captcha()->verify($captcha['captcha_id'], $captcha['captcha_answer']));
        $this->assertSame(CaptchaResult::Expired, $this->captcha()->verify($captcha['captcha_id'], $captcha['captcha_answer']));
    }

    public function test_a_challenge_allows_only_one_guess(): void
    {
        $captcha = $this->solvedCaptcha();

        $this->captcha()->verify($captcha['captcha_id'], 'wrong');

        // The right answer no longer helps: the wrong guess used the challenge up
        $this->assertSame(CaptchaResult::Expired, $this->captcha()->verify($captcha['captcha_id'], $captcha['captcha_answer']));
    }

    public function test_a_challenge_expires(): void
    {
        $captcha = $this->solvedCaptcha();

        $this->travel(config('captcha.ttl_seconds') + 1)->seconds();

        $this->assertSame(CaptchaResult::Expired, $this->captcha()->verify($captcha['captcha_id'], $captcha['captcha_answer']));
    }

    public function test_rejects_an_unknown_or_malformed_id(): void
    {
        $this->assertSame(CaptchaResult::Expired, $this->captcha()->verify('9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d', '1'));
        $this->assertSame(CaptchaResult::Expired, $this->captcha()->verify('../../etc/passwd', '1'));
        $this->assertSame(CaptchaResult::Expired, $this->captcha()->verify(null, '1'));
        $this->assertSame(CaptchaResult::Expired, $this->captcha()->verify(['id'], '1'));
    }

    public function test_handing_out_challenges_is_rate_limited(): void
    {
        for ($i = 0; $i < 30; $i++) {
            $this->getJson('/api/v1/captcha')->assertOk();
        }

        $this->getJson('/api/v1/captcha')->assertStatus(429);
    }
}
