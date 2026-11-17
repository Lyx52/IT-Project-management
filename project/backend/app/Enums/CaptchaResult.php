<?php

namespace App\Enums;

enum CaptchaResult
{
    case Solved;

    /** The challenge existed, but the answer was wrong or not a number. */
    case Wrong;

    /** Unknown, expired or already used challenge. */
    case Expired;
}
