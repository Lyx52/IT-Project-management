<?php

namespace App\Http\Requests;

use Illuminate\Auth\Access\Response;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Support\Facades\Gate;

class UpdateSavedSearchRequest extends FormRequest
{
    /**
     * Checked before validation, so another user's search is a 404 and
     * not a validation error.
     */
    public function authorize(): Response
    {
        return Gate::inspect('manage', $this->route('savedSearch'));
    }

    /**
     * Only the name can change. For different filters, save a new search.
     *
     * @return array<string, mixed>
     */
    public function rules(): array
    {
        return [
            'name' => StoreSavedSearchRequest::nameRule(
                $this->user()->id,
                $this->route('savedSearch')?->id,
            ),
        ];
    }
}
