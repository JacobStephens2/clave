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

## Release

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
