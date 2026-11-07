<?php

namespace App\Console\Commands;

use App\Models\User;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Validator;
use Illuminate\Support\Str;
use Illuminate\Validation\Rules\Password;

/**
 * Bootstraps the initial admin account on a fresh database. Run through
 * deploy/create-admin.sh on the server. Further admins are managed from the
 * website by an existing admin, so this refuses to run once an active admin
 * exists.
 *
 * Only a person at a terminal can run it: it refuses to run outside the CLI
 * (e.g. Artisan::call from a web request) or without an interactive TTY
 * (CI jobs, cron, scripts). The password is read from a hidden prompt, so it
 * never ends up in shell history, logs or an env file.
 */
class CreateFirstAdmin extends Command
{
    protected $signature = 'app:create-first-admin
        {--username= : Username of the admin}
        {--email= : Email of the admin}';

    protected $description = 'Create the initial admin account (only works while no active admin exists)';

    /** Version recorded as accepted for the account created from the CLI. */
    private const PRIVACY_POLICY_VERSION = '1.0';

    public function handle(): int
    {
        if (! app()->runningInConsole() || ! $this->input->isInteractive() || ! $this->hasTerminal()) {
            $this->error('This must be run by a person in an interactive terminal on the server.');

            return self::FAILURE;
        }

        if ($this->activeAdminExists()) {
            $this->error('An admin account already exists. Further admins are managed from the website.');

            return self::FAILURE;
        }

        $username = $this->optionOrAsk('username', 'Username', 'admin');
        $email = $this->optionOrAsk('email', 'Email');

        if ($this->isTaken($username, $email)) {
            $this->error("Username \"{$username}\" or email \"{$email}\" is already used by another account.");

            return self::FAILURE;
        }

        $password = (string) $this->secret('Password (min. 12 characters)');
        $confirmation = (string) $this->secret('Repeat password');

        if (! hash_equals($password, $confirmation)) {
            $this->error('Passwords do not match.');

            return self::FAILURE;
        }

        $validator = Validator::make(
            compact('username', 'email', 'password'),
            [
                'username' => ['required', 'string', 'max:50', 'alpha_dash:ascii'],
                'email' => ['required', 'string', 'email', 'max:255'],
                'password' => ['required', 'string', Password::min(12)],
            ],
        );

        if ($validator->fails()) {
            foreach ($validator->errors()->all() as $message) {
                $this->error($message);
            }

            return self::FAILURE;
        }

        // forceFill: role and the GDPR columns are deliberately not mass assignable
        $user = new User;
        $user->forceFill([
            'username' => $username,
            'email' => $email,
            'password' => $password, // hashed by the model's "hashed" cast
            'role' => 'admin',
            'email_verified_at' => now(),
            'terms_accepted_at' => now(),
            'privacy_policy_version' => self::PRIVACY_POLICY_VERSION,
        ])->save();

        $this->info("Admin \"{$user->username}\" <{$user->email}> created (id {$user->id}).");

        return self::SUCCESS;
    }

    /**
     * Symfony keeps the input "interactive" even when stdin is a pipe, so a
     * password could be fed in by a script. Require a real terminal instead.
     */
    protected function hasTerminal(): bool
    {
        return defined('STDIN') && stream_isatty(STDIN);
    }

    /**
     * Banned or deleted admins don't count, so a locked-out site can be
     * recovered by running this again.
     */
    private function activeAdminExists(): bool
    {
        return $this->allUsers()
            ->where('role', 'admin')
            ->whereNull('banned_at')
            ->whereNull('deleted_at')
            ->exists();
    }

    private function isTaken(string $username, string $email): bool
    {
        // Soft-deleted rows still hold the unique username/email
        return $this->allUsers()
            ->where(function ($query) use ($username, $email) {
                $query->where('username', $username)
                    ->orWhereRaw('LOWER(email) = ?', [Str::lower($email)]);
            })
            ->exists();
    }

    /** Includes soft-deleted rows, even if User ever gets SoftDeletes. */
    private function allUsers()
    {
        return User::query()->withoutGlobalScopes();
    }

    private function optionOrAsk(string $option, string $question, ?string $default = null): string
    {
        $value = $this->option($option);

        return trim((string) ($value ?? $this->ask($question, $default)));
    }
}
