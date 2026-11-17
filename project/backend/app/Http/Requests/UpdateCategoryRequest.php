<?php

namespace App\Http\Requests;

use App\Models\Category;
use Closure;
use Illuminate\Foundation\Http\FormRequest;

class UpdateCategoryRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user()?->isAdmin() ?? false;
    }

    /**
     * @return array<string, mixed>
     */
    public function rules(): array
    {
        return [
            'name' => [
                'required',
                'string',
                'max:50',
                function (string $attribute, mixed $value, Closure $fail): void {
                    if (! is_string($value)) {
                        return;
                    }

                    $query = Category::query()
                        ->whereRaw('LOWER(name) = ?', [mb_strtolower(trim($value))]);

                    $category = $this->route('category');

                    if ($category instanceof Category) {
                        $query->where('id', '!=', $category->id);
                    }

                    if ($query->exists()) {
                        $fail('A category with this name already exists.');
                    }
                },
            ],
        ];
    }

    protected function prepareForValidation(): void
    {
        if (is_string($this->input('name'))) {
            $this->merge(['name' => trim($this->input('name'))]);
        }
    }
}
