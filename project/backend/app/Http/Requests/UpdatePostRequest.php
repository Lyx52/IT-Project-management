<?php

namespace App\Http\Requests;

/**
 * Partial update: only the fields sent are validated and changed.
 */
class UpdatePostRequest extends StorePostRequest
{
    /**
     * @return array<string, mixed>
     */
    public function rules(): array
    {
        return collect(parent::rules())
            ->except(['images', 'images.*'])
            ->map(fn (array $rules) => ['sometimes', ...array_filter($rules, fn ($rule) => $rule !== 'required')])
            ->all();
    }
}
