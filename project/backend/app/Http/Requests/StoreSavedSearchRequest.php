<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class StoreSavedSearchRequest extends FormRequest
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
        $filters = SearchPostsRequest::filterRules();

        // Without any filter every new post would match and notify
        $filters['q'][] = 'required_without_all:type,category_id';

        return [
            'name' => self::nameRule($this->user()->id),
            ...$filters,
        ];
    }

    /**
     * @return array<string, string>
     */
    public function messages(): array
    {
        return [
            'q.required_without_all' => 'Enter a search term or pick a type or category to save.',
        ];
    }

    /**
     * Names are unique per user.
     *
     * @return list<mixed>
     */
    public static function nameRule(int $userId, ?int $ignoreId = null): array
    {
        return [
            'required',
            'string',
            'max:50',
            Rule::unique('saved_searches', 'name')
                ->where('user_id', $userId)
                ->ignore($ignoreId),
        ];
    }
}
