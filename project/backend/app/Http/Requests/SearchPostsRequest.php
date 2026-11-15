<?php

namespace App\Http\Requests;

use App\Enums\PostType;
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
        return self::filterRules();
    }

    /**
     * The search filters, also what a saved search stores.
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
