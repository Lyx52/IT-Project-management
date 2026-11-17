<?php

namespace App\Enums;

enum PostStatus: string
{
    case Pending = 'pending';
    case Approved = 'approved';
    case Rejected = 'rejected';
    case Resolved = 'resolved';
}
