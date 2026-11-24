<?php

namespace App\Http\Controllers\Api\V1\Admin;

use App\Http\Controllers\Controller;
use App\Http\Resources\AdminUserResource;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;

class UserController extends Controller
{
    /**
     * List users for moderation
     *
     * Paginated, newest accounts last so the list is stable while banning.
     * Optional `search` matches username or e-mail, and `status` narrows to
     * banned or active accounts.
     */
    public function index(Request $request): AnonymousResourceCollection
    {
        $validated = $request->validate([
            'search' => ['nullable', 'string', 'max:100'],
            'status' => ['nullable', 'in:all,banned,active'],
        ]);

        $search = $validated['search'] ?? null;
        $status = $validated['status'] ?? 'all';

        $users = User::query()
            ->when($search !== null && $search !== '', function ($query) use ($search) {
                // LOWER(...) LIKE rather than ILIKE, which is Postgres-only and
                // would break the SQLite test runs.
                $term = '%'.mb_strtolower($search).'%';

                $query->where(function ($inner) use ($term) {
                    $inner->whereRaw('LOWER(username) LIKE ?', [$term])
                        ->orWhereRaw('LOWER(email) LIKE ?', [$term]);
                });
            })
            ->when($status === 'banned', fn ($query) => $query->whereNotNull('banned_at'))
            ->when($status === 'active', fn ($query) => $query->whereNull('banned_at'))
            ->withCount('posts')
            ->orderBy('username')
            ->orderBy('id')
            ->paginate(20)
            ->withQueryString();

        return AdminUserResource::collection($users);
    }
}
