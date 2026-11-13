<?php

namespace App\Http\Requests\Api\V1;

use Illuminate\Foundation\Http\FormRequest;

class ReportPostRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'reason' => ['required', 'string', 'min:5', 'max:500'],
        ];
    }

    protected function prepareForValidation(): void
    {
        if ($this->has('reason') && is_string($this->reason)) {
            $this->merge([
                'reason' => trim($this->reason),
            ]);
        }
    }
}
