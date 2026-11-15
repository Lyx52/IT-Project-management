<?php

namespace Tests\Feature;

use App\Enums\CaptchaResult;
use App\Enums\CaptchaType;
use App\Services\CaptchaService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use InvalidArgumentException;
use PHPUnit\Framework\Attributes\DataProvider;
use Tests\Concerns\SolvesCaptcha;
use Tests\TestCase;

class CaptchaTest extends TestCase
{
    use RefreshDatabase, SolvesCaptcha;

    private function captcha(): CaptchaService
    {
        return app(CaptchaService::class);
    }

    private function useType(CaptchaType|string $type): void
    {
        config(['captcha.type' => $type instanceof CaptchaType ? $type->value : $type]);
    }

    /**
     * @return array<string, array{CaptchaType}>
     */
    public static function types(): array
    {
        return array_combine(
            array_map(fn (CaptchaType $type) => $type->value, CaptchaType::cases()),
            array_map(fn (CaptchaType $type) => [$type], CaptchaType::cases()),
        );
    }

    // --- Choosing the type ---

    public function test_defaults_to_the_hash_puzzle(): void
    {
        // phpunit.xml sets no CAPTCHA_TYPE, so this is the shipped default
        $this->getJson('/api/v1/captcha')->assertOk()->assertJsonPath('type', 'hash');
    }

    public function test_reads_the_type_case_insensitively(): void
    {
        $this->useType(' Determinant ');

        $this->assertSame(CaptchaType::Determinant, $this->captcha()->type());
    }

    public function test_refuses_an_unknown_type_instead_of_silently_picking_one(): void
    {
        $this->useType('recaptcha');

        $this->expectException(InvalidArgumentException::class);
        $this->expectExceptionMessage('CAPTCHA_TYPE must be one of math, hash or determinant');

        $this->captcha()->create();
    }

    // --- What each type hands out ---

    public function test_math_hands_out_a_question(): void
    {
        $this->useType(CaptchaType::Math);

        $body = $this->getJson('/api/v1/captcha')->assertOk()->json();

        $this->assertSame(['captcha_id', 'type', 'question', 'expires_in'], array_keys($body));
        $this->assertSame('math', $body['type']);
        $this->assertMatchesRegularExpression('/^What is \d+ [+−] \d+\?$/u', $body['question']);
    }

    public function test_math_asks_both_additions_and_subtractions_and_never_a_negative_answer(): void
    {
        $this->useType(CaptchaType::Math);
        $operators = [];

        for ($i = 0; $i < 200; $i++) {
            $question = $this->captcha()->create()['question'];
            preg_match('/^What is (\d+) ([+−]) (\d+)\?$/u', $question, $m);

            $operators[$m[2]] = true;
            $this->assertGreaterThanOrEqual(1, (int) $m[1]);
            $this->assertLessThanOrEqual(config('captcha.math.max_operand'), (int) $m[3]);
            $this->assertGreaterThanOrEqual(0, $this->solveMath($question));
        }

        // Odds of a false failure: 2^-199
        ksort($operators);
        $this->assertSame(['+', '−'], array_keys($operators));
    }

    public function test_determinant_hands_out_a_question_and_a_2x2_matrix(): void
    {
        $this->useType(CaptchaType::Determinant);

        $body = $this->getJson('/api/v1/captcha')->assertOk()->json();

        $this->assertSame(['captcha_id', 'type', 'question', 'matrix', 'expires_in'], array_keys($body));
        $this->assertSame('determinant', $body['type']);
        $this->assertCount(2, $body['matrix']);

        foreach ($body['matrix'] as $row) {
            $this->assertCount(2, $row);

            foreach ($row as $entry) {
                $this->assertIsInt($entry);
                $this->assertGreaterThanOrEqual(1, $entry);
                $this->assertLessThanOrEqual(config('captcha.determinant.max_entry'), $entry);
            }
        }
    }

    public function test_determinant_answers_can_be_negative_and_are_accepted_as_such(): void
    {
        $this->useType(CaptchaType::Determinant);
        $negativeSeen = false;

        // P(ad < bc) is about one half, so 100 draws practically always hit one
        for ($i = 0; $i < 100 && ! $negativeSeen; $i++) {
            $challenge = $this->captcha()->create();
            $answer = $this->solveDeterminant($challenge['matrix']);

            $this->assertSame(CaptchaResult::Solved, $this->captcha()->verify($challenge['captcha_id'], (string) $answer));
            $negativeSeen = $answer < 0;
        }

        $this->assertTrue($negativeSeen);
    }

    public function test_hash_hands_out_a_puzzle(): void
    {
        $this->useType(CaptchaType::Hash);

        $response = $this->getJson('/api/v1/captcha')->assertOk();

        $this->assertSame(
            ['captcha_id', 'type', 'algorithm', 'salt', 'challenge', 'max_number', 'expires_in'],
            array_keys($response->json()),
        );
        $response->assertJsonPath('algorithm', 'SHA-256')
            ->assertJsonPath('max_number', config('captcha.hash.max_number'));

        $this->assertMatchesRegularExpression('/^[0-9a-f]{24}$/', $response->json('salt'));
        $this->assertMatchesRegularExpression('/^[0-9a-f]{64}$/', $response->json('challenge'));
    }

    public function test_hash_secret_number_is_always_within_the_advertised_range(): void
    {
        $this->useType(CaptchaType::Hash);
        config(['captcha.hash.max_number' => 50]);
        $seen = [];

        for ($i = 0; $i < 200; $i++) {
            $number = $this->solveHash($this->captcha()->create());

            $this->assertGreaterThanOrEqual(0, $number);
            $this->assertLessThanOrEqual(50, $number);
            $seen[$number] = true;
        }

        // Drawn at random, not always the same: odds of a false failure are negligible
        $this->assertGreaterThan(20, count($seen));
    }

    // --- Rules shared by every type ---

    #[DataProvider('types')]
    public function test_hands_out_an_id_and_lifetime_without_caching_the_response(CaptchaType $type): void
    {
        $this->useType($type);

        $this->getJson('/api/v1/captcha')->assertOk()
            ->assertJsonPath('type', $type->value)
            ->assertJsonPath('expires_in', config('captcha.ttl_seconds'))
            ->assertHeader('Cache-Control', 'no-store, private');
    }

    #[DataProvider('types')]
    public function test_hands_out_a_different_challenge_each_time(CaptchaType $type): void
    {
        $this->useType($type);

        $first = $this->getJson('/api/v1/captcha')->json('captcha_id');
        $second = $this->getJson('/api/v1/captcha')->json('captcha_id');

        $this->assertNotSame($first, $second);
    }

    #[DataProvider('types')]
    public function test_accepts_the_right_answer_as_string_or_number(CaptchaType $type): void
    {
        $this->useType($type);
        $asString = $this->solvedCaptcha();
        $asNumber = $this->solvedCaptcha();

        $this->assertSame(CaptchaResult::Solved, $this->captcha()->verify($asString['captcha_id'], " {$asString['captcha_answer']} "));
        $this->assertSame(CaptchaResult::Solved, $this->captcha()->verify($asNumber['captcha_id'], (int) $asNumber['captcha_answer']));
    }

    #[DataProvider('types')]
    public function test_rejects_a_wrong_answer(CaptchaType $type): void
    {
        $this->useType($type);
        $captcha = $this->solvedCaptcha();

        $this->assertSame(
            CaptchaResult::Wrong,
            $this->captcha()->verify($captcha['captcha_id'], (string) ((int) $captcha['captcha_answer'] + 1)),
        );
    }

    public function test_rejects_answers_that_are_not_whole_numbers(): void
    {
        foreach (['', 'twelve', '1e1', '12.0', '0x0c', '--1', '+1', null, [12], 12.0] as $answer) {
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

    public function test_a_challenge_handed_out_before_the_type_changed_can_still_be_answered(): void
    {
        $this->useType(CaptchaType::Math);
        $captcha = $this->solvedCaptcha();

        $this->useType(CaptchaType::Hash);

        $this->assertSame(CaptchaResult::Solved, $this->captcha()->verify($captcha['captcha_id'], $captcha['captcha_answer']));
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
