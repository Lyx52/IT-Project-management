# FindIT deployment guide

How to install FindIT on a new server, configure it, run migrations, set up backups and deploy new versions. Follow the parts in order for a first installation. For later work, jump to the part you need.

You need basic Linux and SSH experience. You don't need to know Laravel or Angular: the scripts in `deploy/` do the application-specific work.

A first installation takes about an hour, most of it waiting for builds and DNS.

## Contents

1. [How production works](#1-how-production-works)
2. [What you need before you start](#2-what-you-need-before-you-start)
3. [Install the server](#3-install-the-server)
4. [Configure the application](#4-configure-the-application)
5. [First deployment](#5-first-deployment)
6. [Migrations](#6-migrations)
7. [Backups](#7-backups)
8. [Redeploying](#8-redeploying)
9. [Moving to a new server](#9-moving-to-a-new-server)
10. [Routine maintenance](#10-routine-maintenance)
11. [Troubleshooting](#11-troubleshooting)
12. [Reference](#12-reference)

---

## 1. How production works

The whole site runs on one Linux VM as six Docker containers, defined in [`docker-compose.prod.yml`](docker-compose.prod.yml). The images are built on the server from the repository; nothing is pulled from a registry except the base images and Anubis's ready-made image.

```
              Internet
                 │  80, 443
        ┌────────▼────────┐        ┌─────────────┐
        │      proxy      │ ─────► │   anubis    │  bot filter, sends
        │                 │ ◄───── │             │  allowed requests back
        └────────┬────────┘        └─────────────┘
                 │  network "web"   Caddy: HTTPS certificate, Angular app,
                 │                  forwards /api/*, /storage/*, /up
        ┌────────▼────────┐        ┌─────────────┐
        │     backend     │        │  scheduler  │  daily cleanup jobs
        │ Laravel :8080   │        │             │
        └────────┬────────┘        └──────┬──────┘
                 │  network "internal" (no internet access)
        ┌────────▼───────────────────────▼──┐
        │                db                 │  Postgres 17, no published port
        └────────────────┬──────────────────┘
                 ┌───────▼───────┐
                 │    backup     │  daily pg_dump ──► Oracle Object Storage
                 └───────────────┘
```

| Container | What it does |
|-----------|--------------|
| `proxy` | The only container with public ports. Gets and renews the Let's Encrypt certificate, redirects HTTP to HTTPS, hands each request to `anubis`, then serves the built Angular app or forwards `/api/*`, `/storage/*` and `/up` to the backend |
| `anubis` | [Anubis](https://github.com/TecharoHQ/anubis), the bot filter. Lets a request through, makes the browser solve a short challenge first, or refuses it. See [1.1](#11-bot-protection-anubis) |
| `backend` | The Laravel API on FrankenPHP, plain HTTP on port 8080, reachable only from the proxy |
| `scheduler` | Same image as `backend`, runs Laravel's scheduled jobs: account purge, removal of old resolved posts and read notifications, cache and token cleanup |
| `db` | PostgreSQL 17 on an internal network with no route in or out |
| `backup` | Dumps the database every day at 02:00 UTC and uploads it to Oracle Cloud |

Data lives in Docker volumes, which survive rebuilds and redeploys:

| Volume | Contents | Backed up automatically |
|--------|----------|-------------------------|
| `itpm_db-data` | The database | Yes, daily |
| `itpm_app-storage` | Uploaded files: avatars, post images, message attachments | **No**, see [7.6](#76-uploaded-files) |
| `itpm_caddy-data`, `itpm_caddy-config` | HTTPS certificates | Not needed, Caddy gets new ones |

Settings live in `.env.production` in the repository folder on the server. It is never committed to git.

### 1.1 Bot protection (Anubis)

Every request passes through Anubis before it reaches the app. The proxy runs two sites: the public one (HTTPS) forwards everything to `anubis`, and Anubis sends the requests it allows back to the proxy's internal site on port 3000, which does the routing. Port 3000 isn't published, so there is no way around Anubis.

```
client ─443→ proxy (HTTPS) ─→ anubis:8923 ─→ proxy :3000 (routing) ─→ backend / Angular app
```

What visitors get, with Anubis's default rules:

| Client | Result |
|--------|--------|
| A browser, first visit | "Making sure you're not a bot!" while it solves a proof-of-work puzzle (difficulty 6: several seconds on a laptop, possibly minutes on an old phone), then the page. A cookie lets every later request through, `/api/*` included, for 7 days |
| Known AI scrapers (GPTBot, ClaudeBot and others), headless Chrome | Refused |
| Google, Bing, DuckDuckGo and other big search engines | Let through |
| curl, scripts, uptime monitors | Let through, so the API commands in this guide work unchanged |
| Anything on `/up`, `/robots.txt`, `/.well-known/*` | Let through |

The site still has no `robots.txt`, so search engines index it as before. Anubis can serve one (`SERVE_ROBOTS_TXT: "true"` on `anubis`), but that one asks *every* crawler to stay away, search engines included.

**When the cookie runs out.** The cookie expires after 7 days and is tied to the visitor's IP address, so a phone that switches networks gets a new challenge. If that happens while the app is open, an API call gets the challenge page instead of data. The app notices this and reloads the page, the challenge runs, and the visitor ends up back where they were. Anything typed into a form that hadn't been sent yet is lost. See [`anubis-interceptor.ts`](project/frontend/src/app/services/anubis-interceptor.ts).

**Where things are:**

| What | Where |
|------|-------|
| Rules (who is allowed, challenged or refused) and puzzle difficulty | [`docker/prod/anubis/botPolicies.yaml`](docker/prod/anubis/botPolicies.yaml). It imports Anubis's default rules, adds an exception for `/up` and sets the difficulty (`thresholds`). Changes apply with `dc restart anubis`. Rule format: [Anubis policy docs](https://anubis.techaro.lol/docs/admin/policies) |
| Version | `image:` of `anubis` in `docker-compose.prod.yml`. Pinned on purpose: the default rules come with the image and change between versions. To upgrade, change the tag, deploy, and do the checks in [5.3](#53-check-that-it-works) |
| Proxy side | [`docker/prod/proxy/Caddyfile`](docker/prod/proxy/Caddyfile) |
| Settings | `ANUBIS_KEY` and `ANUBIS_COOKIE_EXPIRATION`, see [4.2](#42-settings) |

**The proxy setup has to stay in this shape:**

- The public site sets `X-Real-IP` from the real connection. Anubis refuses requests without it, and the internal site passes it to the backend as `X-Forwarded-For`. Without that, Laravel would see Anubis's address as every visitor's IP, and the login, sign-up and posting limits would apply to the whole site at once.
- The Content-Security-Policy is set on the internal site, not the public one. Anubis's challenge page needs an inline script, which the app's CSP forbids. Anubis's own pages therefore get no CSP, and the app's pages and API responses keep the strict one.
- `X-TLS-SNI-Name` uses `{http.request.tls.server_name}`. Anubis's Caddy example uses `{tls_server_name}`, which Caddy doesn't recognise. It sends the text unchanged, and Anubis then refuses every request as domain fronting.

---

## 2. What you need before you start

- [ ] **A server.** The current one is an Azure VM. Any Linux VM with a public IP works the same way.
- [ ] **A hostname** for the site, e.g. `findit.example.com`, or the free Azure DNS name of the VM (`<label>.<region>.cloudapp.azure.com`).
- [ ] **An e-mail address** for Let's Encrypt certificate notices.
- [ ] **Access to the GitHub repository** `Lyx52/IT-Project-management`, with admin rights if you will set up automatic deploys.
- [ ] **An Oracle Cloud account** for backups. The free tier is enough.
- [ ] **The team's password manager**, to store `.env.production`.
- [ ] Optional: a **Resend account** and a verified mail domain, if the site should send e-mail.

If you are **replacing an existing server**, also get the current `.env.production` from the password manager and read [section 9](#9-moving-to-a-new-server) first.

---

## 3. Install the server

### 3.1 Create the VM

Recommended:

| Setting | Value |
|---------|-------|
| Image | Ubuntu Server 24.04 LTS |
| Size | 2 vCPU, 4 GB RAM (Azure `Standard_B2s`). 2 GB works with swap ([3.5](#35-add-swap-on-small-vms)) |
| Disk | 30 GB or more |
| Login | SSH key, no password login |

**The firewall is the VM's network security group (NSG) in Azure.** It filters traffic before it reaches the VM, so nothing on the server can get around it. That includes Docker, which bypasses a host firewall like `ufw` for published ports. It is also managed outside the VM, so someone who breaks into the server can't switch it off. On another cloud, use that provider's firewall in the same way (AWS security groups, Oracle security lists, and so on).

Allow only these inbound ports and deny everything else (the NSG's default):

| Port | Protocol | Source | Why |
|------|----------|--------|-----|
| 22 | TCP | Your team's IP addresses if they are fixed, otherwise any | SSH. If deploys run from GitHub Actions, their IPs change, so the source must be any. SSH then relies on key-only login |
| 80 | TCP | Any | Let's Encrypt validation and the redirect to HTTPS |
| 443 | TCP | Any | HTTPS |
| 443 | UDP | Any | HTTP/3 (optional, Caddy falls back to TCP) |

Never open 5432 or any other port. The database must never be reachable from outside.

### 3.2 Point the hostname at the server

Create a DNS `A` record for the hostname that points to the VM's public IP. With an Azure DNS label, set it under the VM's public IP → **Configuration** → **DNS name label**.

Check from your own machine before going on; Caddy can't get a certificate until this resolves:

```bash
dig +short findit.example.com     # must print the VM's public IP
```

### 3.3 Install Docker and git

SSH into the server, then:

```bash
sudo apt-get update && sudo apt-get upgrade -y
sudo apt-get install -y git openssl curl
curl -fsSL https://get.docker.com | sudo sh        # Docker Engine + Compose plugin
sudo usermod -aG docker "$USER"                     # run docker without sudo
```

Log out and back in so the group change applies, then check:

```bash
docker version
docker compose version        # Docker Compose version v2.x or newer
```

### 3.4 Docker logs and host firewall

Docker keeps container logs forever by default, which eventually fills the disk. Limit them:

```bash
sudo tee /etc/docker/daemon.json > /dev/null <<'EOF'
{ "log-driver": "json-file", "log-opts": { "max-size": "10m", "max-file": "5" } }
EOF
sudo systemctl restart docker
```

**Host firewall (`ufw`): optional.** The NSG from [3.1](#31-create-the-vm) is the real firewall. `ufw` doesn't protect the containers: Docker-published ports bypass it, which is why the `db` container must never get a `ports:` entry. It only adds a second layer for services on the host itself, e.g. one installed later by mistake. If you turn it on, allow SSH **first**, or you lock yourself out:

```bash
sudo ufw allow OpenSSH
sudo ufw allow 80/tcp
sudo ufw allow 443
sudo ufw enable
```

### 3.5 Add swap on small VMs

The Angular production build needs about 2 GB of memory. On a VM with 2 GB RAM or less, add swap so the build isn't killed:

```bash
sudo fallocate -l 2G /swapfile && sudo chmod 600 /swapfile
sudo mkswap /swapfile && sudo swapon /swapfile
echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
```

### 3.6 Clone the repository

The repository must be at `/opt/IT-Project-management`. The automatic deploy workflow uses that path.

```bash
sudo mkdir -p /opt/IT-Project-management
sudo chown "$USER": /opt/IT-Project-management
git clone https://github.com/Lyx52/IT-Project-management.git /opt/IT-Project-management
cd /opt/IT-Project-management
git checkout main
```

**If the repository is private**, the server needs read access. Create a read-only deploy key:

```bash
ssh-keygen -t ed25519 -N '' -f ~/.ssh/github_deploy -C "findit-server"
cat ~/.ssh/github_deploy.pub
```

Add the printed key on GitHub under the repository's **Settings → Deploy keys** (leave "Allow write access" off). Then tell SSH to use it and clone over SSH:

```bash
cat >> ~/.ssh/config <<'EOF'
Host github.com
  IdentityFile ~/.ssh/github_deploy
  IdentitiesOnly yes
EOF
git clone git@github.com:Lyx52/IT-Project-management.git /opt/IT-Project-management
```

The server always deploys the branch that is checked out. Keep it on `main` and never edit tracked files on the server; `deploy.sh` stops if the checkout has local changes.

### 3.7 Add the `dc` shortcut

Every manual `docker compose` command for production needs the production settings and compose file. Without them, Compose fails with errors like `set APP_KEY in .env.production`. This guide uses the shortcut `dc` for the full command:

```bash
echo "alias dc='docker compose --env-file /opt/IT-Project-management/.env.production -f /opt/IT-Project-management/docker-compose.prod.yml'" >> ~/.bashrc
source ~/.bashrc
```

---

## 4. Configure the application

### 4.1 Create `.env.production`

**New installation:**

```bash
cd /opt/IT-Project-management
deploy/init-env.sh findit.example.com admin@example.com
```

This writes `.env.production` with random secrets (`APP_KEY`, `DB_PASSWORD`, `DB_ROOT_PASSWORD`, `ANUBIS_KEY`), readable only by you. It refuses to overwrite an existing file.

Then add this line, which `init-env.sh` doesn't write yet:

```bash
echo 'ACCOUNT_PURGE_DAYS=30' >> .env.production
```

Without it, `docker-compose.prod.yml` falls back to 21 days and deleted accounts are purged earlier than the documented 30 days. See [7.7](#77-backup-retention-and-account-deletion).

**Replacing a server:** don't run `init-env.sh`. Copy the saved `.env.production` from the password manager into `/opt/IT-Project-management/.env.production` and run `chmod 600 .env.production`. Check that it has `ACCOUNT_PURGE_DAYS=30`, and add the line if not.

**Save a copy now.** Put the whole file in the team's password manager. Without its `APP_KEY`, a restored database has unreadable messages.

### 4.2 Settings

Edit `.env.production` with any editor. Every setting:

| Variable | Default | Meaning |
|----------|---------|---------|
| `SITE_ADDRESS` | from `init-env.sh` | Hostname of the site, without `https://` |
| `ACME_EMAIL` | from `init-env.sh` | Let's Encrypt contact address |
| `APP_NAME` | `Lost and Found` | Name used in e-mails. You may change it to `FindIT` |
| `APP_KEY` | random | Encryption key. **Never change it** once the site has data, see [4.3](#43-settings-you-cant-simply-change) |
| `DB_DATABASE`, `DB_USERNAME` | `app` | Database and user Laravel connects with. Leave them |
| `DB_PASSWORD` | random | Password of the `app` database user, see [4.3](#43-settings-you-cant-simply-change) |
| `DB_ROOT_PASSWORD` | random | Password of the `postgres` superuser, see [4.3](#43-settings-you-cant-simply-change) |
| `MAIL_MAILER` | `log` | `log` writes mail to the backend log; `resend` sends it |
| `MAIL_FROM_ADDRESS` | empty | Sender address, on a domain verified in Resend |
| `RESEND_API_KEY` | empty | Resend API key |
| `EMAIL_VERIFICATION_ENABLED` | `false` | Require new users to verify their e-mail. Needs working mail first |
| `CAPTCHA_TYPE` | `hash` | Sign-up CAPTCHA: `hash`, `math` or `determinant`. See the README |
| `ANUBIS_KEY` | random | Signs the bot filter's cookie ([1.1](#11-bot-protection-anubis)). `deploy.sh` adds it to older files that lack it. Changing it only means every visitor solves the challenge once more |
| `ANUBIS_COOKIE_EXPIRATION` | `168h` | How long a solved challenge lasts, e.g. `24h` or `720h`. Not in the generated file; add the line to change it |
| `BACKUP_UPLOAD_URL` | empty | Write-only Oracle bucket URL, set in [section 7](#7-backups) |
| `BACKUP_AT` | `02:00` | Daily backup time, UTC. Not in the generated file; add the line to change it |
| `ACCOUNT_PURGE_DAYS` | `21` (compose file), should be `30` | Days a deleted account stays suspended before it is permanently removed. The app's default is 30, but `docker-compose.prod.yml` still falls back to 21, so **set `ACCOUNT_PURGE_DAYS=30` explicitly** ([4.1](#41-create-envproduction)). Tied to the backup retention, read [7.7](#77-backup-retention-and-account-deletion) before changing it |

**After changing a setting** on a running site, recreate the containers so they pick it up:

```bash
deploy/deploy.sh
```

`dc up -d` also works when you don't want to pull new code. Laravel caches its config at container start, so a plain `restart` is not enough.

### 4.3 Settings you can't simply change

- **`APP_KEY`** encrypts message bodies. A different key makes every existing message unreadable. Only set it on a brand-new, empty installation.
- **`DB_PASSWORD` and `DB_ROOT_PASSWORD`** are written into Postgres only once, when the database volume is first created. Changing them in `.env.production` afterwards doesn't change the database, and the backend can no longer log in. To change one, set it in Postgres first and then in the file:
  ```bash
  dc exec db psql -U postgres           # then type: \password app   (or \password postgres)
  # enter the new password twice, quit with \q
  # put the same password in .env.production, then:
  dc up -d
  ```
- **`DB_DATABASE` and `DB_USERNAME`** are also only applied when the volume is created. Leave them as `app`.

---

## 5. First deployment

### 5.1 Deploy

```bash
cd /opt/IT-Project-management
deploy/deploy.sh
```

The first run builds all images, which takes 5–15 minutes. The script:

1. Pulls the latest commit of the checked-out branch (`git pull --ff-only`).
2. Builds the images.
3. Starts the database. On an empty volume this also creates the `app` user and database.
4. Runs the migrations, which create all tables (see [section 6](#6-migrations)).
5. Starts all containers.
6. Waits until the backend answers on `/up` and prints `>> Deployed: https://<your host>`.

You will also see a warning that `BACKUP_UPLOAD_URL` is not set. That is expected until you finish [section 7](#7-backups).

### 5.2 Create the first admin

A new database has no accounts, and production never loads test data. Create the first admin by hand, in an interactive shell on the server:

```bash
deploy/create-admin.sh <username> <email>
```

It asks for the password at a hidden prompt (at least 12 characters). On purpose, it only works in an interactive terminal on the server itself, and only while no active admin exists.

**More admins.** The website has no way to make someone an admin yet. Until it does, promote an existing account in the database:

```bash
dc exec db psql -U app app -c "UPDATE users SET role = 'admin' WHERE username = '<username>'"
```

### 5.3 Check that it works

```bash
curl -sI https://findit.example.com/up | head -1      # HTTP/2 200
dc ps                                                  # all containers "Up", db with no host port
```

Then in a browser:

- [ ] The site opens over HTTPS without a certificate warning. On the first visit, Anubis's "Making sure you're not a bot!" page shows for a few seconds.
- [ ] The browser console (F12) shows no Content-Security-Policy errors, on the challenge page or after it.
- [ ] You can register a new account and sign in.
- [ ] You can create a post with a photo. It shows on My Posts as pending.
- [ ] Signed in as the admin, open **Moderation** in the header (`/admin`) and approve the post on the **Pending posts** tab.
- [ ] The post and its photo appear on the Items page and the Map page.
- [ ] Signed in as a second account, you can send a message with an image attachment about that post.

If the moderation page doesn't load, you can also approve the post through the API to tell a frontend problem from a backend one. On the server or your own machine:

```bash
SITE=https://findit.example.com
read -rp 'Admin e-mail: ' EMAIL; read -rsp 'Admin password: ' PW; echo
export EMAIL PW
TOKEN=$(python3 -c 'import json,os; print(json.dumps({"email": os.environ["EMAIL"], "password": os.environ["PW"]}))' \
  | curl -s "$SITE/api/v1/login" -H 'Accept: application/json' -H 'Content-Type: application/json' -d @- \
  | python3 -c 'import json,sys; print(json.load(sys.stdin)["access_token"])')
AUTH=(-H 'Accept: application/json' -H "Authorization: Bearer $TOKEN")

curl -s "${AUTH[@]}" "$SITE/api/v1/admin/moderation/queue"              # note the post's "id"
curl -s "${AUTH[@]}" -X POST "$SITE/api/v1/admin/posts/<id>/approve"
curl -s "${AUTH[@]}" -X POST "$SITE/api/v1/logout"
unset EMAIL PW TOKEN AUTH
```

If a step fails, see [section 11](#11-troubleshooting).

---

## 6. Migrations

Migrations are the versioned changes to the database structure, in [`project/backend/database/migrations`](project/backend/database/migrations).

### 6.1 How they run

You never run migrations by hand during a normal deploy. `deploy.sh` runs `php artisan migrate --force` with the new image **before** it replaces the running containers:

- **A migration fails:** the deploy stops and the old version keeps running. On Postgres, Laravel runs each migration in a transaction, so the failed one leaves no half-done changes. Migrations of the same deploy that ran before it stay applied. Fix the migration in a new commit and deploy again.
- **All migrations succeed:** the new containers start.

The restore script (`deploy/restore-db.sh --live`) also runs migrations after a restore, so an older backup is brought up to the current schema.

### 6.2 Check the state

```bash
dc exec backend php artisan migrate:status    # "Ran" or "Pending" per migration
```

After a deploy, every migration should show `Ran`.

### 6.3 Rules for new migrations

- Every schema change is a **new** migration file. Never edit one that has already run in production; production won't run it again.
- Migrations run while the old version is still serving requests. Prefer additive changes (new tables, new nullable columns). To remove or rename something, do it in two releases: first stop using it, then drop it.
- CI runs every migration against Postgres 17 and rolls them back, so a migration that only works on SQLite fails before it reaches production.

### 6.4 Rolling back a migration

Rarely needed: a new table or column that the old code ignores does no harm. If you must undo one, do it **while the release that added it is still deployed**, because the rollback code is in that release:

```bash
dc run --rm backend php artisan migrate:rollback --step=1 --force    # undoes the last migration
```

Rolling back a migration that dropped a column or table doesn't bring the data back. For that, restore a backup ([7.5](#75-restoring-after-a-failure)).

---

## 7. Backups

The `backup` container dumps the database every day at 02:00 UTC and uploads it to the private Oracle Cloud Object Storage bucket `db-backups`. Oracle deletes each backup after 7 days. The server's upload URL can only write: it can't list, read or delete backups, so an attacker on the server can't destroy them.

**Not in the backup:**

- **`APP_KEY`.** Keep `.env.production` in the password manager.
- **Uploaded files.** See [7.6](#76-uploaded-files).

### 7.1 Set up the bucket (once)

This runs in Oracle Cloud Shell, not on the server.

1. In the Oracle Cloud console, open **Cloud Shell** (the `>_` icon, top right). The OCI CLI there is already logged in.
2. Get the script into Cloud Shell: gear icon → **Upload** → `deploy/backup-storage.sh`, or `git clone` the repository.
3. Run:
   ```bash
   bash backup-storage.sh setup
   ```
   It creates the bucket (private, no versioning), the 7-day delete rule, the IAM policy that rule needs, and the write-only upload URL. It ends with a line `BACKUP_UPLOAD_URL=https://...`.
4. On the server, put that line in `.env.production`, replacing the empty `BACKUP_UPLOAD_URL=` line. Then:
   ```bash
   deploy/deploy.sh                 # restarts the backup container with the URL
   dc exec backup backup now        # first backup right away
   dc ps backup                     # after a minute: (healthy)
   ```
5. Back in Cloud Shell, check that it arrived:
   ```bash
   bash backup-storage.sh list
   ```

The upload URL is valid for **one year**. Put a reminder in the team calendar to renew it ([section 10](#10-routine-maintenance)).

### 7.2 Monitoring

- `dc ps backup` shows `unhealthy` when no backup succeeded in the last 26 hours or the last one failed after 3 attempts, 10 minutes apart.
- `dc logs backup` says why.
- `deploy.sh` warns on every deploy while `BACKUP_UPLOAD_URL` is missing.

There is no alerting. Check `dc ps` when you log in to the server, and at least monthly.

### 7.3 Extra backup before risky work

Before a large migration, a restore or a server move:

```bash
dc exec backup backup now
```

### 7.4 Test restore

Do this after setting up backups, after changing anything about them, and every few months. It doesn't touch the live database.

1. In Cloud Shell, get a download link for the newest backup (valid for 1 hour):
   ```bash
   bash backup-storage.sh url
   ```
   For a specific backup, add its name: `bash backup-storage.sh url app-20261107T020000Z-1a2b3c4d.dump`.
2. On the server:
   ```bash
   deploy/restore-db.sh '<url from step 1>'
   ```
   The script checks the file, loads it into a temporary database, prints row counts per table next to the live ones plus the newest migration in each, and then deletes the temporary database.
3. The backup is good when the counts are close to live (live has changed since) and the latest migration matches. Record it in the log below.

| Date | Who | Backup | Where | Result |
|------|-----|--------|-------|--------|
| 2026-11-07 | Kan6de | `app-20261107T101120Z-ad6414e7.dump` | Local copy of the production stack, storage emulated (not Oracle) | OK: 25 users restored (live had 24 after a purge), latest migration matched. Live restore (`--live`) also tested |

### 7.5 Restoring after a failure

Use this when the live database is lost or damaged. Everything written after the backup was made (at most one day) is lost.

1. If the server itself is gone, first set up a new one ([section 9](#9-moving-to-a-new-server)).
2. In Cloud Shell, get a download link: `bash backup-storage.sh url`. If the newest backup is broken, pick an older one from `bash backup-storage.sh list`.
3. On the server:
   ```bash
   deploy/restore-db.sh --live '<url>'
   ```
   It loads the backup into a new database first and only touches live data once that worked. You confirm by typing the database name (`app`). It then stops the backend, renames the current database to `app_before_restore_<time>`, swaps the restored one in, runs newer migrations and starts everything again.
4. Check the site. When it looks right, drop the old database with the command the script printed.

### 7.6 Uploaded files

Avatars, post images and message attachments are in the `itpm_app-storage` volume and are **not** part of the daily backup. Back them up by hand before a server move or risky maintenance:

```bash
cd /opt/IT-Project-management
docker run --rm -v itpm_app-storage:/data:ro -v "$PWD":/out alpine \
  tar czf /out/app-storage.tar.gz -C /data .
```

The archive contains personal data. Copy it straight to where it's needed and delete it from the server afterwards; don't leave copies around.

To put the files back:

```bash
dc stop backend scheduler
docker run --rm -v itpm_app-storage:/data -v "$PWD":/in alpine \
  tar xzf /in/app-storage.tar.gz -C /data
dc start backend scheduler
rm app-storage.tar.gz
```

### 7.7 Backup retention and account deletion

How long Oracle keeps backups is part of what the site promises users about account deletion. A deleted account is suspended at once and permanently removed from the database after 30 days. It must be gone from backups too within `deleted_account_limit_days` (39) in `config/retention.php`. Worst case, deleted data still exists for:

30 days (the suspension) + 1 day (until the daily purge runs) + 7 days (in the last backup that has it) + 1 day (until Oracle's daily delete rule runs) = **39 days**

This only holds if production really purges after 30 days. Check that `.env.production` has `ACCOUNT_PURGE_DAYS=30` ([4.1](#41-create-envproduction)).

So don't change the 7 days on Oracle's side on its own, whether in the console or in `RETENTION_DAYS` in `deploy/backup-storage.sh`. `account_purge_days + backup_retention_days + 2` must stay at or below `deleted_account_limit_days`: keeping backups longer means purging accounts sooner, or promising users a longer limit. To change it:

1. Set `RETENTION_DAYS` in `deploy/backup-storage.sh` and `backup_retention_days` in `project/backend/config/retention.php` to the same value, and lower `account_purge_days` to match. `tests/Feature/UserPruningTest.php` fails if the sum breaks the limit.
2. Merge and deploy the change.
3. In Cloud Shell, run `bash backup-storage.sh setup` again so Oracle's delete rule is updated. This also creates a new upload URL: put it in `.env.production` and run `deploy/deploy.sh`.

The full explanation is in the README under [Data retention](README.md#data-retention).

---

## 8. Redeploying

### 8.1 Automatic deploys from GitHub

Once set up, every push to `main` runs [`.github/workflows/deploy.yml`](.github/workflows/deploy.yml), which connects to the server over SSH and runs `deploy/deploy.sh`.

The deploy workflow does **not** wait for CI. Only branch protection keeps broken code off `main`: on GitHub, under **Settings → Branches**, require pull requests and the CI jobs (Backend, Frontend, Docker image) to pass before merging into `main`.

**Setup (once):**

1. On your own machine, create an SSH key for GitHub Actions. It must have no passphrase:
   ```bash
   ssh-keygen -t ed25519 -N '' -f findit-deploy -C "github-actions-deploy"
   ```
2. On the server, allow that key for the user who owns `/opt/IT-Project-management`. Optionally restrict it to the deploy script, so the key can't do anything else:
   ```bash
   echo 'command="/opt/IT-Project-management/deploy/deploy.sh",no-port-forwarding,no-agent-forwarding,no-X11-forwarding,no-pty <contents of findit-deploy.pub>' >> ~/.ssh/authorized_keys
   ```
3. Get the server's host key and compare its fingerprint with the one on the server (`ssh-keygen -lf /etc/ssh/ssh_host_ed25519_key.pub`):
   ```bash
   ssh-keyscan -t ed25519 findit.example.com > known_hosts
   ssh-keygen -lf known_hosts
   ```
4. On GitHub, under **Settings → Secrets and variables → Actions**, add these secrets:

   | Secret | Value |
   |--------|-------|
   | `DEPLOY_SSH_KEY` | Contents of the private key file `findit-deploy` |
   | `DEPLOY_KNOWN_HOSTS` | Contents of `known_hosts` from step 3 |
   | `DEPLOY_HOST` | The server's hostname or IP |
   | `DEPLOY_USER` | The SSH user from step 2 |

   Then, on the **Variables** tab, add `DEPLOY_ENABLED` with the value `true`.
5. Delete `findit-deploy` and `findit-deploy.pub` from your machine.
6. Test it: **Actions → Deploy → Run workflow** on `main`. The log should end with `>> Deployed: https://...`.

To pause automatic deploys, set `DEPLOY_ENABLED` to `false`.

### 8.2 Manual deploy

```bash
ssh <user>@<server>
/opt/IT-Project-management/deploy/deploy.sh
```

This is the same as the automatic deploy. Use it when automatic deploys are off or you want to watch the output.

### 8.3 What a deploy does to the running site

The old containers keep running while the new images build and migrations run. They are then replaced, which causes a few seconds of downtime. Uploaded files, the database and certificates are in volumes and are kept.

If `/up` doesn't answer within about a minute, `deploy.sh` exits with an error. It checks through Anubis and the proxy, so a fault in any of them fails the deploy. At that point the **new** containers are already running, so the site may be down. Check `dc logs backend anubis proxy` and roll back ([8.4](#84-rolling-back-a-bad-release)) if you can't fix it quickly.

### 8.4 Rolling back a bad release

**Preferred:** revert the bad commit on `main` through a pull request (`git revert <commit>`). Merging it deploys the previous code, automatically or with `deploy.sh`.

If the bad release added migrations that the old code can't live with, roll them back **first**, while the bad release is still deployed ([6.4](#64-rolling-back-a-migration)).

**Emergency, without waiting for a pull request:** check out the last good commit on the server and start it directly. `deploy.sh` can't do this, because it only pulls forward.

```bash
cd /opt/IT-Project-management
git log --oneline -10                   # find the last good commit
git checkout <good-commit>
dc build && dc up -d
```

The checkout is now detached. Once the fix or revert is on `main`, go back with `git checkout main` and run `deploy/deploy.sh`. If automatic deploys are on, they fail until then, because `deploy.sh` stops when the checkout is detached.

---

## 9. Moving to a new server

Do this to replace the server, change cloud provider or recover from a lost VM.

1. **On the old server (if it still runs):**
   ```bash
   dc exec backup backup now               # fresh database backup
   ```
   Back up the uploaded files ([7.6](#76-uploaded-files)) and copy `app-storage.tar.gz` to your machine, e.g. with `scp`.
2. **New server:** do all of [section 3](#3-install-the-server), but don't change DNS yet.
3. **Configuration:** put the saved `.env.production` in place ([4.1](#41-create-envproduction)). Keep the same `APP_KEY` and `BACKUP_UPLOAD_URL`.
4. **Point DNS at the new server** and wait until `dig +short <hostname>` returns the new IP.
5. **Deploy:** `deploy/deploy.sh`. This creates an empty database and gets a new certificate.
6. **Restore the database:** get a download link in Cloud Shell (`bash backup-storage.sh url`) and run `deploy/restore-db.sh --live '<url>'` ([7.5](#75-restoring-after-a-failure)).
7. **Restore the uploaded files** ([7.6](#76-uploaded-files)).
8. **Check** the site as in [5.3](#53-check-that-it-works), signing in with an existing account instead of creating the admin. Check that old messages are readable; garbled text means a wrong `APP_KEY`.
9. **GitHub Actions:** update `DEPLOY_HOST`, `DEPLOY_USER` and `DEPLOY_KNOWN_HOSTS`, and add the deploy key on the new server ([8.1](#81-automatic-deploys-from-github)).
10. **Old server:** stop it with `dc down`. Once the new one has run for a few days, delete the VM and its disks; they hold personal data.

If the old server is gone, skip step 1. Files uploaded since your last manual file backup are lost.

---

## 10. Routine maintenance

| When | What |
|------|------|
| Each login | `dc ps`: all containers up, `backup` healthy |
| Monthly | Install OS updates: `sudo apt-get update && sudo apt-get upgrade -y`, reboot if asked. Containers start again on their own |
| Monthly | Check disk space with `df -h` and `docker system df` |
| Every few months | Test restore ([7.4](#74-test-restore)) and record it |
| After a restore | Drop the `app_before_restore_*` database once the site is fine |
| **Yearly** | Renew the backup upload URL: in Cloud Shell, `bash backup-storage.sh setup` again, put the new `BACKUP_UPLOAD_URL` in `.env.production`, run `deploy/deploy.sh`. The old URL stops working |
| When rotating secrets | Update the copy of `.env.production` in the password manager |

Certificates renew automatically. `deploy.sh` removes unused images after each successful deploy. To free more space: `docker builder prune -f`.

---

## 11. Troubleshooting

Start with `dc ps` and `dc logs <container>`.

| Problem | Cause and fix |
|---------|---------------|
| `docker compose` says `set APP_KEY in .env.production` or similar | The command ran without `--env-file .env.production`. Use the `dc` alias ([3.7](#37-add-the-dc-shortcut)). The log command printed by `deploy.sh` has the same problem; run `dc logs backend` instead |
| `permission denied ... docker.sock` | Your user isn't in the `docker` group yet. Run `sudo usermod -aG docker $USER`, then log out and in |
| `deploy.sh`: `Not possible to fast-forward` or `local changes would be overwritten` | Someone changed files on the server, or the checkout isn't on `main`. Check with `git status`. Discard local changes with `git checkout -- .` (they are lost) |
| `deploy.sh`: `You are not currently on a branch` | The checkout is detached after an emergency rollback. Run `git checkout main` |
| Build stops with exit code 137 or `Killed` | Out of memory during the Angular build. Add swap ([3.5](#35-add-swap-on-small-vms)) |
| Browser shows a certificate error, `dc logs proxy` shows ACME errors | DNS doesn't point at the server yet, or ports 80/443 are closed in the NSG. Fix that; Caddy retries on its own |
| Deploy stops at "Running migrations" | A migration failed; the old version is still running. Read the error above it and fix the migration in a new commit |
| "Site did not become healthy" | Run `dc logs backend anubis proxy`. `anubis` saying `X-Real-IP header is not set`: the proxy's Caddyfile lost its `header_up X-Real-IP` line. Common causes: a wrong `DB_PASSWORD` ([4.3](#43-settings-you-cant-simply-change)) or a missing setting. Roll back if needed ([8.4](#84-rolling-back-a-bad-release)) |
| Backend log: `password authentication failed for user "app"` | `DB_PASSWORD` in `.env.production` doesn't match the database. See [4.3](#43-settings-you-cant-simply-change) |
| Messages show errors or garbled text | `APP_KEY` differs from the one the messages were written with. Put the original key back |
| `backup` is `unhealthy` | Run `dc logs backup`. `BACKUP_UPLOAD_URL is not set`: finish [7.1](#71-set-up-the-bucket-once). Upload fails with HTTP 4xx: the URL expired or was replaced, run `setup` again ([section 10](#10-routine-maintenance)) |
| Large uploads fail | PHP accepts at most 50 MB per request (`docker/prod/backend/php.ini`). The app has its own, lower limits per file type |
| Every visitor gets Anubis's "Access Denied" page | Look the error code up with `dc logs anubis \| grep <code>`, the log names the rule. `domain-fronting`: see the last point in [1.1](#11-bot-protection-anubis). Any other rule: check the latest change to `docker/prod/anubis/botPolicies.yaml` or the Anubis version |
| The challenge page never finishes, or the site keeps showing it | Open the browser console. CSP errors: the CSP was moved back to the public site in the Caddyfile, see [1.1](#11-bot-protection-anubis). Otherwise check that cookies aren't blocked for the site |
| All visitors share one rate limit (e.g. "too many attempts" for everyone) | The backend sees Anubis's IP instead of the visitor's. The internal `:3000` site in the Caddyfile must keep `header_up X-Forwarded-For {header.X-Real-IP}` |
| `create-admin.sh` refuses to run | It needs an interactive shell on the server itself (`ssh -t`, no pipes) and no active admin. For more admins, see [5.2](#52-create-the-first-admin) |

---

## 12. Reference

### 12.1 Commands

`dc` is the alias from [3.7](#37-add-the-dc-shortcut). Run the `deploy/` scripts from `/opt/IT-Project-management`.

| Command | Does |
|---------|------|
| `deploy/init-env.sh <host> <email>` | Creates `.env.production` (once) |
| `deploy/deploy.sh` | Pull, build, migrate, restart |
| `deploy/create-admin.sh <user> <email>` | First admin account (once) |
| `deploy/restore-db.sh <url>` | Test restore, live database untouched |
| `deploy/restore-db.sh --live <url>` | Replace the live database with a backup |
| `bash backup-storage.sh setup\|list\|url` | Oracle bucket, in Cloud Shell |
| `dc ps` | Container status |
| `dc logs -f backend` | Follow backend logs (also `proxy`, `anubis`, `backup`, `scheduler`, `db`) |
| `dc exec backend php artisan migrate:status` | Migration state |
| `dc exec backup backup now` | Database backup right away |
| `dc exec db psql -U app app` | SQL shell on the live database |
| `dc up -d` | Apply changed settings without pulling code |

### 12.2 Files

| File | Purpose |
|------|---------|
| `docker-compose.prod.yml` | The production containers, networks and volumes |
| `.env.production` | Production settings and secrets, server only, never in git |
| `docker/prod/backend/` | Backend image: FrankenPHP config, PHP limits, start-up script |
| `docker/prod/proxy/` | Proxy image: builds the Angular app, Caddy config with security headers |
| `docker/prod/anubis/` | Bot filter rules |
| `docker/prod/backup/` | Backup image and schedule |
| `docker/db/initdb/` | Creates the `app` database user on a new database volume |
| `deploy/` | The scripts above |
| `.github/workflows/deploy.yml` | Automatic deploy on push to `main` |
| `.github/workflows/ci.yml` | Tests and builds for every pull request |

### 12.3 Scheduled jobs

All times UTC. Defined in `project/backend/routes/console.php` and `docker/prod/backup/backup.sh`.

| Time | Job |
|------|-----|
| 00:00 | Permanently delete accounts deleted more than `ACCOUNT_PURGE_DAYS` (30) days ago |
| 00:30 | Remove expired cache entries, including unanswered CAPTCHAs |
| 00:45 | Remove expired API tokens |
| 01:00 | Delete posts resolved more than six months ago and notifications read more than 90 days ago. Each run appends its counts to `storage/logs/platform-data-pruning.log` |
| 02:00 | Database backup to Oracle |

Check the scheduler's recent runs with `dc logs --tail 50 scheduler`, and the cleanup counts with `dc exec scheduler tail storage/logs/platform-data-pruning.log`.
