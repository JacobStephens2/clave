# `admin.clave.dance` room administration plan

**Status:** proposed  
**Owner:** Jacob  
**Target:** desktop-first authenticated web UI at `https://admin.clave.dance`  
**Related systems:** `packages/server`, `/var/lib/clave/clave.sqlite`, Apache, systemd

## 1. Current state

There is no room-administration UI today. The public server exposes only player
operations (create, inspect seat availability, join, resume, and WebSocket play),
plus `/healthz` and a hot-seat completion beacon. Operational room management is
currently performed directly against SQLite while the service is stopped.

The database already contains most of the information an administrator needs:
room code, seat occupancy, creation and last-action times, whether play started,
test status, terminal status, the versioned resume envelope, and durable game
events. The running process additionally knows live WebSocket counts. It does not
yet offer a safe, sanitized administrative read model or coordinated room
mutations.

## 2. Product scope

The first release should let Jacob:

- see whether Clave and its database are healthy;
- see total, active, waiting, completed, abandoned, test, and stale room counts;
- search and filter rooms by code, lifecycle state, test status, engine version,
  creation time, and last activity;
- inspect one room's safe operational details and event history;
- see whether Lead and Follow seats are claimed and currently connected;
- close an active room with a player-visible reason;
- delete an individual room after an explicit confirmation; and
- clear a filtered set or all rooms only after a fresh verified backup and a
  typed high-friction confirmation.

The UI is an operations tool, not a spectator or cheat surface. It must never
show or return seat tokens, cards in either hand, raw `envelope_json`, full
content bytes, or controls that edit game state, scores, cards, or turns.

## 3. Recommended architecture

Keep room administration inside the existing authoritative Node process, because
that process owns both the in-memory room map and WebSocket connections. A
separate process writing the same SQLite rows could delete a room while the game
server continued to hold and mutate its stale in-memory copy.

Add:

- `packages/admin`: a small, separately built React application;
- `packages/server/src/admin/`: authenticated API routes, sanitized DTOs, room
  queries, lifecycle commands, audit logging, and CSRF protection;
- a host switch in the server that serves only the admin application and
  `/api/admin/*` when the normalized request host is `admin.clave.dance`;
- an Apache `admin.clave.dance` virtual host that proxies to the same loopback
  Node service; and
- explicit `RoomManager` methods for close/delete/clear so database state,
  in-memory state, and sockets change together.

The public `clave.dance` host must return 404 for admin routes and admin assets.
The admin host must not expose player create/join/resume routes. Both restrictions
should be enforced in Node in addition to Apache routing.

The admin UI should consume only `AdminOverview`, `AdminRoomSummary`,
`AdminRoomDetail`, and `AdminActionResult` DTOs. It should never import or render
`GameState`, `ResumeEnvelope`, or `PlayerSnapshot`. This preserves the game's
hidden-information boundary while allowing a purpose-built operational UI.

## 4. Authentication and request security

For a single-owner hobby deployment, use Apache Basic Authentication over TLS for
the first release. Store only an Apache password hash in a root-managed file such
as `/etc/apache2/clave-admin.htpasswd`; do not put credentials in Git, a systemd
unit, JavaScript, or SQLite.

Defense in depth is still required:

1. Accept admin traffic only when `Host` is exactly `admin.clave.dance` (allowing
   an optional port only in local tests).
2. Require Apache authentication for every path on the admin virtual host,
   including static assets and APIs.
3. Require `Origin: https://admin.clave.dance` on every mutating request.
4. Issue a short-lived, random, host-only CSRF cookie and require its value in an
   `X-CSRF-Token` header. Use `Secure`, `SameSite=Strict`, and no parent-domain
   cookie.
5. Permit only `GET`, `POST`, and `DELETE` methods that are explicitly routed;
   reject all other admin requests.
6. Add a restrictive CSP, `frame-ancestors 'none'`, `X-Content-Type-Options:
   nosniff`, `Referrer-Policy: no-referrer`, and `Cache-Control: no-store` to
   admin HTML and API responses.
7. Redact authorization headers, cookies, seat tokens, resume envelopes, and
   query strings from application logs.

Basic Authentication can later be replaced with an identity-aware proxy or OIDC
without changing the room-management API. That is not required for v1.

## 5. Sanitized data model

`AdminRoomSummary` should contain only:

- room code;
- created and last-active timestamps;
- lifecycle: waiting, active, completed, lost, abandoned, or unresumable;
- `started` and `test` flags;
- Lead/Follow seat-claimed booleans;
- Lead/Follow live-connection counts;
- active role, turn phase, phrase number, phrase count, and action sequence;
- engine version and a short content-hash prefix; and
- durable event count and most recent event type.

`AdminRoomDetail` adds the safe event history and operational metadata, but not
hands, draw/discard contents, card identities on the floor, action payloads,
tokens, or the serialized state. Derive all fields server-side; never send a raw
database row and rely on the browser to hide properties.

Add an `admin_actions` table in the next forward-only SQLite migration:

```text
id, occurred_at, actor, action, target_room_code, request_id, details_json
```

`details_json` may record counts, filters, reasons, and backup filenames. It must
not contain credentials, tokens, or room envelopes. The Basic Auth username
forwarded by Apache is the initial `actor` value.

## 6. API shape

All endpoints are same-origin on `admin.clave.dance`:

- `GET /api/admin/session` — identity, CSRF token, server and engine version.
- `GET /api/admin/overview` — health and lifecycle counts.
- `GET /api/admin/rooms` — paginated, searchable, sortable room summaries.
- `GET /api/admin/rooms/:code` — sanitized room detail and event history.
- `POST /api/admin/rooms/:code/close` — mark a room abandoned, close its
  sockets with a clear message, and retain it for audit/metrics.
- `DELETE /api/admin/rooms/:code` — delete one room and cascading game events,
  remove it from memory, and close sockets.
- `POST /api/admin/rooms/clear` — delete the rooms matching an explicit filter,
  or all rooms, after a verified backup.

Every mutation requires a generated `requestId`, CSRF token, confirmation value,
and optional human-readable reason. Repeating the same `requestId` must return the
original outcome rather than applying the operation twice.

## 7. Coordinated room lifecycle operations

Move socket bookkeeping behind a small room-connection registry. Administrative
commands should execute in this order:

1. validate authentication, host, origin, CSRF token, request ID, target, and
   confirmation;
2. acquire a short process-local maintenance lock for the affected room(s);
3. for a bulk clear, run the existing SQLite `VACUUM INTO` backup flow and verify
   the new file with `PRAGMA integrity_check` before deleting anything;
4. commit the database change and audit row in one transaction;
5. update the `RoomManager` map;
6. notify and close affected WebSockets with a dedicated administrative close
   code; and
7. return counts plus the audit/request ID.

Normal player actions must be rejected with a retryable maintenance response
while their room is locked. The lock lasts only for the transaction and socket
coordination; there is no global maintenance mode for single-room operations.

The clear endpoint defaults to test and terminal rooms. Clearing active rooms or
all rooms requires typing a server-provided phrase such as
`CLEAR 7 ACTIVE ROOMS`, then confirming again in the native dialog. The response
must include the verified backup filename.

## 8. UI design

Use the existing Clave visual language, but make this surface calmer and denser:

- top bar: `CLAVE ADMIN`, production badge, health, engine version, refresh;
- overview cards: waiting, active, recently active, terminal, test, total;
- main table: room, state, seats, live connections, sequence, created, last
  active, version, test flag;
- filters and search encoded in the URL so views are bookmarkable;
- room drawer/detail page with event timeline and close/delete controls;
- destructive actions in a visually distinct danger panel with exact scope,
  consequences, typed confirmation, and success feedback; and
- automatic refresh every 10 seconds, paused while a dialog is open, with a
  manual refresh button. Server-sent events can be considered later.

Desktop is the primary target, but the table must collapse into accessible room
cards on narrow screens. All controls need keyboard operation, visible focus,
status announcements, and reduced-motion support.

## 9. Delivery phases

### Phase A — safe read-only console

- Add DNS and a TLS certificate for `admin.clave.dance`.
- Add the authenticated Apache virtual host and security headers.
- Add host-separated admin static serving and read-only APIs.
- Build overview, filters, room list, and sanitized detail/event views.
- Prove that no tokens, envelopes, hands, or hidden card data cross the API.

### Phase B — individual room management

- Add the audit migration and idempotent request IDs.
- Add coordinated close and delete operations to `RoomManager`/database/socket
  layers.
- Add confirmations, reasons, success/error feedback, and audit display.

### Phase C — verified bulk cleanup

- Extract the existing verified backup logic into a reusable server module.
- Add the maintenance lock and backup-before-clear workflow.
- Add filtered and all-room clear with typed confirmation and detailed results.
- Exercise failure injection: backup failure, integrity failure, DB failure,
  socket race, duplicate request, and service restart.

## 10. Verification and launch gate

Automated coverage must include:

- unit tests for sanitized DTO construction and every filter;
- tests proving serialized admin responses contain no token, envelope, content,
  hand, deck, discard, or card-state fields;
- host-boundary tests showing each domain rejects the other's API;
- authentication, Origin, CSRF, method, rate-limit, and idempotency tests;
- in-memory database tests for close, individual delete, cascading events, audit
  rows, and bulk clear;
- socket tests proving managed rooms are notified/closed and cannot write after
  deletion;
- Playwright tests for login, list/filter/detail, confirmation, keyboard use,
  narrow layouts, and reduced motion; and
- a clean production build, typecheck, unit suite, and existing public-game E2E
  suite to prevent admin work from affecting play.

Production launch requires:

1. DNS for `admin.clave.dance` resolves to the existing server.
2. A verified database backup exists before the migration.
3. Apache config test and the existing `stephens.page`/`clave.dance` smoke tests
   pass before and after enabling the new virtual host.
4. TLS is valid and HTTP redirects to HTTPS.
5. Unauthenticated requests receive `401` and reveal no admin HTML or JSON.
6. Authenticated read-only inspection works without changing a live drill room.
7. Close/delete work against test rooms and leave ordinary gameplay healthy.
8. A bulk-clear drill creates a restorable, integrity-checked backup first.
9. Node remains bound only to `127.0.0.1`; Apache remains the only public
   listener.
10. The deployment runbook and rollback instructions include the admin host,
    credential rotation, database migration, and audit table.

## 11. Deliberately deferred

- multiple admin roles or per-user permissions;
- player accounts, bans, moderation, chat, or support impersonation;
- editing game state or content from production;
- viewing private hands or downloadable resume envelopes;
- live spectator mode;
- general analytics dashboards beyond room lifecycle counts; and
- exposing the admin service outside the Apache/TLS boundary.

