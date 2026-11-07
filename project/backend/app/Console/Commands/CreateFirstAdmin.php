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
 * Interactive by default: the password is read from a hidden prompt, so it
 * never ends up in shell history, CI logs or an env file. With
 * --no-interaction a random password is generated and printed once.
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

        [$password, $generated] = $this->readPassword();
        if ($password === null) {
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

        if ($generated) {
            $this->newLine();
            $this->warn('Generated password (shown only once, store it in your password manager):');
            $this->line($password);
        }

        return self::SUCCESS;
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

        if ($value === null) {
            $value = $this->input->isInteractive() ? $this->ask($question, $default) : $default;
        }

        return trim((string) $value);
    }

    /**
     * @return array{0: ?string, 1: bool} the password, and whether it was generated
     */
    private function readPassword(): array
    {
        if (! $this->input->isInteractive()) {
            return [Str::password(24), true];
        }

        $password = (string) $this->secret('Password (min. 12 characters)');
        $confirmation = (string) $this->secret('Repeat password');

        if (! hash_equals($password, $confirmation)) {
            $this->error('Passwords do not match.');

            return [null, false];
        }

        return [$password, false];
    }
}
