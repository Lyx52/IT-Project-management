<?php

namespace App\Http\Requests;

use App\Enums\PostType;
use Closure;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class SearchPostsRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    /**
     * @return array<string, mixed>
     */
    public function rules(): array
    {
        return [
            ...self::filterRules(),
            'date_from' => ['nullable', 'date_format:Y-m-d'],
            'date_to' => [
                'nullable',
                'date_format:Y-m-d',
                function (string $attribute, mixed $value, Closure $fail): void {
                    $dateFrom = $this->input('date_from');

                    // ISO date strings sort chronologically when both have passed
                    // date_format validation.
                    if (is_string($dateFrom) && is_string($value) && $value < $dateFrom) {
                        $fail('The to date must be on or after the from date.');
                    }
                },
            ],
        ];
    }

    /**
     * Shared non-date filters, also what a saved search stores.
     *
     * @return array<string, mixed>
     */
    public static function filterRules(): array
    {
        return [
            'q' => ['nullable', 'string', 'max:100'],
            'type' => ['nullable', Rule::enum(PostType::class)],
            'category_id' => ['nullable', 'integer', 'exists:categories,id'],
        ];
    }
}
