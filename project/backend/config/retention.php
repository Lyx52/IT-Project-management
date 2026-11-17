<?php

/*
| How long personal data of a deleted account may survive, and the numbers
| that add up to it. See "Retention and account deletion" in README.md.
|
| Worst case, after a user deletes their account the data still exists for:
|
|     account_purge_days       soft-deleted, waiting for the hard delete
|   + 1 day                    until the daily model:prune run picks it up
|   + backup_retention_days    in the last backup taken before the hard delete
|   + 1 day                    until Oracle's daily lifecycle run deletes it
|
| which must stay within deleted_account_limit_days: 21 + 1 + 7 + 1 = 30.
| tests/Unit/RetentionConfigTest.php checks this.
*/

return [

    // AC-17: a deleted account must be gone everywhere, backups included,
    // within this many days of the deletion request.
    'deleted_account_limit_days' => 30,

    // Oracle deletes database backups after this many days. Must match
    // RETENTION_DAYS in deploy/backup-storage.sh.
    'backup_retention_days' => 7,

    // Soft-deleted users are permanently deleted after this many days.
    // Set ACCOUNT_PURGE_DAYS in .env.production to change it. Only lower it,
    // or lower the backup retention first, or AC-17 is broken.
    'account_purge_days' => (int) env('ACCOUNT_PURGE_DAYS', 21),

];
