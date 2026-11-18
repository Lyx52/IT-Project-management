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
| The account remains suspended for 30 days before permanent deletion. The
| daily pruning schedule and backup lifecycle can extend removal from backups
| to 39 days after the request: 30 + 1 + 7 + 1.
*/

return [

    // Maximum time until personal data is removed from the database and backups.
    'deleted_account_limit_days' => 39,

    // Oracle deletes database backups after this many days. Must match
    // RETENTION_DAYS in deploy/backup-storage.sh.
    'backup_retention_days' => 7,

    // Soft-deleted accounts remain suspended for 30 days before permanent deletion.
    'account_purge_days' => (int) env('ACCOUNT_PURGE_DAYS', 30),

];
