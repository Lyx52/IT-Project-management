<?php

namespace App\Http\Requests;

use App\Services\MessageAttachmentService;
use Illuminate\Contracts\Validation\Validator;
use Illuminate\Foundation\Http\FormRequest;

class StoreMessageRequest extends FormRequest
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
            'body' => ['nullable', 'required_without:attachments', 'string', 'max:2000'],
            'user_id' => ['sometimes', 'integer'],
            'attachments' => ['sometimes', 'array', 'max:'.MessageAttachmentService::MAX_FILES],
            'attachments.*' => [
                'file',
                'mimetypes:'.implode(',', MessageAttachmentService::allowedTypes()),
                'max:'.MessageAttachmentService::MAX_VIDEO_KB,
            ],
        ];
    }

    /**
     * Photos are limited to 5 MB, videos to 20 MB.
     *
     * @return array<int, callable>
     */
    public function after(): array
    {
        return [function (Validator $validator): void {
            foreach ($this->file('attachments', []) as $index => $file) {
                if ($file->isValid()
                    && in_array($file->getMimeType(), MessageAttachmentService::IMAGE_TYPES, true)
                    && $file->getSize() > MessageAttachmentService::MAX_IMAGE_KB * 1024) {
                    $validator->errors()->add("attachments.$index", 'Photos can be at most 5 MB.');
                }
            }
        }];
    }
}
