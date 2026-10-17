# Clave operations

The production process is the single Hono server on port 8787. It serves the built
client, owns WebSocket rooms, and writes the resume envelope and action in one SQLite
transaction before broadcasting.

The current `stephens.page` host already exposes Apache on ports 80 and 443, so
the production handoff uses [`apache-clave.conf`](apache-clave.conf) and the
step-by-step [`server-agent-deployment.md`](server-agent-deployment.md). The
Node service binds only to `127.0.0.1:8787`. [`Caddyfile`](Caddyfile) remains an
alternative template for a fresh host where Caddy already owns the public ports;
do not install it alongside the existing Apache listener.

## Automatic releases

The `CI` GitHub Actions workflow verifies every push and PR. A successful push to
the repository's default branch (including a merged PR) then deploys to the
`production` environment. `workflow_dispatch` can retry the default branch without
creating another commit. PRs, tags, and other branches cannot deploy.

CI uses Node 22 to match the server, runs release-packaging and validation checks,
ShellCheck,
`npm ci`, the full unit suite, typechecking, and the production build. It packages
the exact checked-out source and all four built packages into one immutable Actions
artifact. `/release.json` identifies its commit. No credentials or `node_modules`
are shipped in the artifact.

The deployment job rejects superseded commits and serializes releases without
cancelling an in-progress deployment. It streams the artifact over host-key-pinned
SSH to `clave-deploy@stephens.page`. That account's key only permits
`deploy <40-character SHA>`; it cannot open a shell or forward connections. The
private key is an environment secret, rather than Jacob's personal SSH key.

The root-owned `ops/deploy-release.sh` helper:

1. Takes a server-side lock and prepares `/opt/clave/releases/<SHA>` without changing
   the running application. Production dependencies, including native SQLite, are
   installed as the unprivileged `clave-deploy` user for the server's Node version.
2. Makes the release root-owned and read-only, then checks the current deployment
   guard. Recently active rooms block deployment; automation never uses `--force`.
3. Stops the app, checks the guard again to close the last-action race, and runs the
   existing verified backup service before changing the release symlink.
4. Switches the symlink atomically, starts the app, and verifies loopback health and
   the served commit. Actions then checks the public health and commit endpoints.

On activation failure, the previous application is restarted automatically if the
database schema is unchanged. If startup migrated the schema, the app is stopped
and the job fails with a manual-restore instruction; automation never overwrites
the live database. The verified backup remains available for the existing restore
procedure.

## Deployment credentials and helper updates

Bootstrap and helper updates use `ssh jacob@stephens.page`, with Jacob's existing
sudo access. Copy `ops/install-deployment.sh`, `ops/deploy-release.sh`,
`ops/receive-release.sh`, `ops/validate-release.mjs`, and the dedicated Ed25519
**public** key to a temporary
server directory. Run `sudo bash <directory>/install-deployment.sh <public-key-file>`.
This installs the account, root-owned forced command and deployment helper, and a
sudo rule restricted to that helper. Updating repository helper scripts alone does
not replace the root-owned server copies; install reviewed updates through this
same administrator path.

The GitHub `production` environment allows only the current default branch
(`master`) and has two environment secrets:

- `CLAVE_DEPLOY_SSH_KEY`: the dedicated Ed25519 private key.
- `CLAVE_DEPLOY_KNOWN_HOSTS`: the `stephens.page` Ed25519 host-key entry obtained
  through the already trusted administrator SSH connection.

Rotate the key by installing its replacement public key and updating the private
key environment secret together. If the default branch is renamed, update the
environment's branch policy too; the workflow condition discovers the default
branch dynamically. Do not add required environment reviewers if deployment should
remain automatic.

Inspect the workflow's `deploy` job and `/release.json` to identify the live release.
If the active-room guard blocks a release, finish the game and rerun the workflow
on the default branch. A superseded run intentionally fails before connecting; its
newer default-branch run owns deployment.

## Manual release fallback

1. Run the test, typecheck, and build gates in CI.
2. Run `npm run deploy:guard -w @clave/server`; only use `-- --force` after checking
   with both players that no room should remain active.
3. Back up the database and verify the backup before replacing the release.
4. Install dependencies with `npm ci`, build, atomically update `/opt/clave/current`,
   and restart `clave.service`.
5. Check `/healthz`, reconnect an active drill room, and run the device smoke matrix.

Database migrations are forward-only through `PRAGMA user_version`. Rollback means
restoring the verified pre-release backup into a fresh path and pointing the prior
release at that path. Never copy the live database file directly.

The Apache/Caddy and systemd files are templates for `/etc/apache2`, `/etc/caddy`,
and `/etc/systemd/system`. The timer retains 14 days of backups by default. Run a
restore drill before launch: open the newest backup in a fresh path, run `PRAGMA
integrity_check`, start the service against it, and verify that every room rehydrates.
