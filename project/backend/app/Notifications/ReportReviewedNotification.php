<?php

namespace App\Notifications;

use App\Models\Report;
use Illuminate\Bus\Queueable;
use Illuminate\Notifications\Notification;

/**
 * Tells the person who reported a post that a moderator has dealt with it.
 *
 * Only the reporter is told. The post's author is notified separately when the
 * post itself is taken down, and is deliberately not told about a report that
 * came to nothing: it would name no one useful and invites retaliation.
 */
class ReportReviewedNotification extends Notification
{
    use Queueable;

    public const ACTION_TAKEN = 'action_taken';

    public const DISMISSED = 'dismissed';

    public function __construct(
        public readonly Report $report,
        public readonly string $outcome,
    ) {}

    /**
     * @return array<int, string>
     */
    public function via(object $notifiable): array
    {
        return ['database'];
    }

    /**
     * No personal data: the reporter already saw the post, and nothing here
     * names the author or any other reporter.
     *
     * @return array<string, mixed>
     */
    public function toArray(object $notifiable): array
    {
        $actionTaken = $this->outcome === self::ACTION_TAKEN;

        return [
            'report_id' => $this->report->id,
            'post_id' => $this->report->post_id,
            'post_title' => $this->report->post?->title,
            'outcome' => $this->outcome,
            'message' => $actionTaken
                ? 'Thanks for your report. A moderator reviewed it and acted on the post.'
                : 'Thanks for your report. A moderator reviewed it and decided the post can stay.',
        ];
    }
}
