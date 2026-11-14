<?php

namespace App\Policies;

use App\Models\SavedSearch;
use App\Models\User;
use Illuminate\Auth\Access\Response;

class SavedSearchPolicy
{
    /**
     * Saved searches are private: only their owner sees, renames or deletes
     * them. Anyone else gets 404, so ids don't reveal they exist.
     */
    public function manage(User $user, SavedSearch $savedSearch): Response
    {
        return $user->id === $savedSearch->user_id
            ? Response::allow()
            : Response::denyAsNotFound();
    }
}
