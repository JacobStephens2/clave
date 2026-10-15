# Server-agent deployment: `clave.dance`

This is the handoff for the agent operating the Linux server that already hosts
`stephens.page`. The application and deployment materials must come from an exact
Git commit prepared and verified in this repository; the server agent owns only
machine-specific installation, routing, TLS, service operation, and deployed
verification.

## Mission and non-negotiable constraints

Deploy the web game at `https://clave.dance` with its same-origin HTTP API and
WebSocket multiplayer. Preserve the existing `stephens.page` site and every
unrelated service.

- Do not replace, disable, or move the existing Apache installation.
- Do not bind the Node process to a public interface. The supplied systemd unit
  binds it to `127.0.0.1:8787`; only Apache should accept public traffic.
- Do not deploy a moving branch. Obtain `DEPLOY_COMMIT` from the Mac-side handoff
  and check out that exact SHA.
- Do not force a deployment past `deploy-guard` unless Jacob explicitly confirms
  that any recently active rooms can be interrupted.
- Do not overwrite the live SQLite file or copy it while the service is running.
  Use the supplied verified backup job.
- `playclave.com` forwarding is managed at Porkbun, separately from the game
  server. Its apex and `www` currently redirect to `https://clave.dance`; do not
  move their DNS to this server as part of an app deployment. See
  [domain-forwarding.md](domain-forwarding.md) for the verified settings and the
  outstanding permanent-redirect requirement.
- Stop and report before changing anything if the observed host differs materially
  from the preflight expectations below.

## Architecture already implemented

One Node process serves all three public surfaces:

- `/` and other browser paths: the production React build;
- `/api/*` and `/healthz`: room and health HTTP endpoints; and
- `/ws`: the authoritative multiplayer WebSocket.

The browser creates or joins a room using the shared room code. The room code is
the rendezvous identifier; a separate 128-bit seat token stored on each player's
device authorizes that device as Lead or Follow. Accepted actions and the resume
envelope are written transactionally to `/var/lib/clave/clave.sqlite` before
role-specific snapshots are broadcast. Run only one application process for v1.

Apache terminates TLS and reverse-proxies every path to `127.0.0.1:8787`. The
specific `/ws` mapping must precede `/`. The supplied Apache template uses the
HTTP upgrade support present in Apache 2.4.58.

## 1. Preflight without mutation

Record the output of these checks in the deployment report:

```sh
hostnamectl
getent ahostsv4 clave.dance
sudo ss -ltnp
sudo apache2ctl -S
sudo apache2ctl -M
sudo systemctl status apache2 --no-pager
node --version
npm --version
command -v node
command -v npm
```

Expected public state at handoff time:

- `clave.dance` resolves to `68.183.62.24`;
- ports 80 and 443 are owned by Apache 2.4.58 on Ubuntu;
- `http://clave.dance` currently reaches Apache's existing/default site; and
- `https://clave.dance` currently presents a certificate for a different host.

The server needs Node 22 or newer. If it is absent, install an actively supported
Node release at or above 22 using the server's normal package-management policy.
If `command -v node` is not `/usr/bin/node`, update `ExecStart` in both supplied
systemd units to the exact absolute path before installing them.

Before editing Apache, make a dated, root-readable backup of its current enabled
site configuration and record `apache2ctl -S`. Never replace the
`stephens.page` virtual host.

## 2. Prepare an immutable application release

Repository:
`https://github.com/JacobStephens2/clave.git`

Create `/opt/clave/releases/<DEPLOY_COMMIT>` from that exact commit. Do not use a
later `master` implicitly. Within the release run:

```sh
npm ci
npm test
npm run typecheck
npm run build
```

All four commands must pass. Keep the release directory read-only to the `clave`
service user. Create an atomic `/opt/clave/current` symlink to the release only
after the gates pass.

Create the runtime identity and writable directories if they do not exist:

```sh
sudo useradd --system --home-dir /var/lib/clave --shell /usr/sbin/nologin clave
sudo install -d -o root -g root -m 0755 /opt/clave /opt/clave/releases
sudo install -d -o clave -g clave -m 0700 /var/lib/clave /var/backups/clave
```

`useradd` is expected to report that the user already exists on subsequent
deployments; do not recreate or renumber an existing account.

## 3. Install and verify the systemd service

Install these repository files without editing unrelated units:

- `ops/clave.service` → `/etc/systemd/system/clave.service`
- `ops/clave-backup.service` → `/etc/systemd/system/clave-backup.service`
- `ops/clave-backup.timer` → `/etc/systemd/system/clave-backup.timer`

Then run:

```sh
sudo systemctl daemon-reload
sudo systemctl enable --now clave.service
sudo systemctl status clave.service --no-pager
curl --fail --silent --show-error http://127.0.0.1:8787/healthz
```

The health response must identify `service: "clave"` and the current engine
version. Confirm with `ss` that port 8787 listens only on `127.0.0.1`, not on
`0.0.0.0` or `::`.

Also exercise room creation directly against the loopback service:

```sh
curl --fail --silent --show-error \
  -H 'Content-Type: application/json' \
  -d '{"role":"lead","test":true}' \
  http://127.0.0.1:8787/api/rooms
```

Treat the returned seat token as a temporary secret. It is acceptable to delete
this test room naturally through expiry; do not include the token in a public
deployment report.

## 4. Add the Apache virtual host and TLS

Enable the required modules if they are not already enabled:

```sh
sudo a2enmod proxy proxy_http headers ssl
```

Install `ops/apache-clave.conf` as
`/etc/apache2/sites-available/clave.conf`, enable only that new site, and validate
before reload:

```sh
sudo a2ensite clave.conf
sudo apache2ctl configtest
sudo systemctl reload apache2
```

At this point `http://clave.dance/healthz` must proxy to Clave. If it does not,
inspect the vhost ordering and logs; do not weaken or remove the existing
`stephens.page` vhost to make it work.

Install Certbot's Apache plugin through the server's standard Ubuntu packages if
needed, then obtain and install the certificate with an HTTP-to-HTTPS redirect:

```sh
sudo certbot --apache --redirect -d clave.dance
sudo apache2ctl configtest
sudo systemctl reload apache2
sudo certbot renew --dry-run
```

Certbot may create a separate `*-le-ssl.conf`; that is normal. Inspect the final
port-443 vhost and confirm that it retains both proxy mappings, especially the
`/ws` rule with `upgrade=websocket` before the `/` rule.

## 5. Enable and prove verified backups

After the application has created its SQLite database:

```sh
sudo systemctl start clave-backup.service
sudo systemctl status clave-backup.service --no-pager
sudo systemctl enable --now clave-backup.timer
sudo systemctl list-timers clave-backup.timer --all
```

Confirm that a dated file exists in `/var/backups/clave` and that the service log
says the backup passed `PRAGMA integrity_check`. The timer keeps 14 days by
default. Complete a restore drill into a fresh path before calling the production
launch gate complete; never test restoration by replacing the live database.

## 6. Public multiplayer verification

Run all of these checks after TLS is valid:

1. `curl --fail https://clave.dance/healthz` returns Clave's JSON response.
2. `https://clave.dance` loads without a certificate warning and the browser's
   network log shows no mixed-content failures.
3. On device A, choose **Two devices**, create a room as Lead, and copy its code.
4. On device B, open the same HTTPS URL, enter the code, and join as Follow.
5. Confirm each device sees only its own hand and both show `connected`.
6. Take an action on each device and confirm both snapshots update.
7. Refresh one device mid-game; it must reclaim its seat and restore the same
   committed state in under five seconds.
8. Inspect Apache and service logs for WebSocket errors, upgrade failures, process
   restarts, or SQLite errors.

The broader Phase 5 gate still requires the complete two-device game, the
three-device browser matrix, latency measurement, crash/upgrade drills, restore
drill, metrics queries, and no game-blocking bug. Do not mark that task complete
from a homepage-only smoke test.

## 7. Subsequent deploys and rollback

For every later release:

1. prepare and fully verify a new immutable release directory;
2. as the `clave` user and with `CLAVE_DB_PATH=/var/lib/clave/clave.sqlite`, run
   `node packages/server/dist/deploy-guard.js` from the current release;
3. run and verify `clave-backup.service`;
4. atomically repoint `/opt/clave/current` to the new exact release;
5. restart `clave.service`; and
6. repeat loopback health, public health, room reconnect, and log checks.

Rollback application code by repointing the symlink to the previous immutable
release and restarting. If a database rollback is truly required, stop and use a
verified backup restored into a fresh path as described in `ops/README.md`; do not
write an older file over the live database.

## Required handback

Report:

- deployed commit SHA;
- Node, npm, Apache, and Certbot versions;
- final vhost filenames and enabled modules;
- `systemctl status` summaries for the app and backup timer;
- loopback and public health responses;
- certificate subject, issuer, and expiry;
- confirmation that only Apache exposes public ports and Node is loopback-only;
- backup filename and integrity result;
- two-device room-code, action, and reconnect results; and
- any deviations, warnings, or deferred Phase 5 gates.
