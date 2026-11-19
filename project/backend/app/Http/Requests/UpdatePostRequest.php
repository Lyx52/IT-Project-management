<?php

namespace App\Http\Requests;

use App\Models\Post;
use App\Services\PostImageService;
use Illuminate\Contracts\Validation\Validator;
use Illuminate\Validation\Rule;

/**
 * Partial update: only the fields sent are validated and changed.
 *
 * Photos are changed with `images[]` (new ones to add) and `remove_images[]`
 * (ids of existing ones to delete). A post keeps at most 5 in the end.
 */
class UpdatePostRequest extends StorePostRequest
{
    /**
     * @return array<string, mixed>
     */
    public function rules(): array
    {
        $rules = parent::rules();
        $post = $this->route('post');

        return [
            ...collect($rules)
                ->except(['images', 'images.*'])
                ->map(fn (array $rule) => ['sometimes', ...array_filter($rule, fn ($item) => $item !== 'required')])
                ->all(),
            'images' => $rules['images'],
            'images.*' => $rules['images.*'],
            'remove_images' => ['sometimes', 'array'],
            'remove_images.*' => [
                'integer',
                Rule::exists('post_images', 'id')->where('post_id', $post instanceof Post ? $post->id : 0),
            ],
        ];
    }

    /**
     * @return array<int, callable>
     */
    public function after(): array
    {
        return [function (Validator $validator): void {
            $post = $this->route('post');

            if (! $post instanceof Post || $validator->errors()->isNotEmpty()) {
                return;
            }

            $removed = count(array_unique($this->input('remove_images', [])));
            $total = $post->images()->count() - $removed + count($this->file('images', []));

            if ($total > PostImageService::MAX_IMAGES) {
                $validator->errors()->add('images', 'A post can have at most '.PostImageService::MAX_IMAGES.' photos.');
            }
        }];
    }
}
