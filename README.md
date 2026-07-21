# Clave — A Partner Dance Game (Salsa)

Clave is a cooperative card game for two players — a Lead and a Follow — who dance
a salsa song together, one 8-count at a time. Play positions, moves, and
flourishes; protect your Connection; finish the song with as much Style as you
can. It is the first entry in the planned *Partner Dance Game* series.

v1 is a single responsive web app with a headless TypeScript engine, hot-seat
pass-and-play, and server-authoritative two-device rooms. The governing,
adjudicated build plan is [`docs/plans/clave-plan.md`](docs/plans/clave-plan.md).

An additional macOS-first Unity 6.5 + C# hot-seat implementation lives in
[`unity/`](unity/README.md). It is a parallel desktop version and does not replace
the web v1 or its governing plan.

## Play locally

Requires Node 22 or newer.

```sh
npm install
npm run dev
```

Open `http://localhost:5173`. The client and room server start together. Hot-seat
games are saved after every accepted action in the browser; online rooms are saved
transactionally in SQLite. The home screen and song banner can start or pause
Spotify's official Llorarás embed; Clave does not bundle the copyrighted recording
or synchronize it to turns. Distinct Move, Position, and Flourish landing cues,
plus lesson, turn, stumble, and finish feedback, are synthesized locally with the
Web Audio API; the SFX control is independent of the music player and remembers
its setting on the device. A responsive **How to play**
rulebook is available from both the home screen and live table, with its balance
values read from the same validated content as the engine.

Verification commands:

```sh
npm test
npm run test:e2e
npm run typecheck
npm run lint
npm run build
npm run check:unity
```

`npm run play` opens the same engine as a terminal game.

## Application map

- `packages/content` — validated JSON cards, decks, balance values, and Llorarás song
- `packages/engine` — deterministic rules, legal actions, private snapshots, replay
- `packages/client` — responsive React PWA for hot-seat and online play
- `packages/server` — Hono/WebSocket rooms and transactional SQLite persistence
- `ops` — Apache/Caddy, systemd, verified backup, deploy-guard, and metric-query materials
- `unity/Clave` — macOS-first Unity UI Toolkit client and deterministic C# engine

## Repository map

- [`docs/rules/game-rules.md`](docs/rules/game-rules.md) — the rulebook (rules of record)
- [`docs/rules/decisions.md`](docs/rules/decisions.md) — rules decisions and rulings
- [`docs/cards/v1-card-list.md`](docs/cards/v1-card-list.md) — the complete v1 card set and the Llorarás song deck
- [`docs/plans/`](docs/plans/) — the v1 build plan, its adversarial review, and the adjudication
- [`docs/unity-vs-web-implementation-report.md`](docs/unity-vs-web-implementation-report.md) — comparison of Unity/Hearthstone-style and browser/BGA-style Clave development
- [`docs/living-documents/1-concept-brief.md`](docs/living-documents/1-concept-brief.md) — pitch, pillars, non-goals
- [`docs/living-documents/0-dance.md`](docs/living-documents/0-dance.md) — the Llorarás song/dance breakdown behind the v1 song deck
- [`docs/handwritten-notes/`](docs/handwritten-notes/) — journal scans and transcriptions the design grew from
- [`docs/clave-tech-stack.md`](docs/clave-tech-stack.md) — historical five-platform architecture study (post-v1 reference; superseded for v1 by the plan)
- [`docs/archive/`](docs/archive/) — superseded drafts and the original pre-production templates
- [`research/`](research/) — salsa music, dance, and game-design research notes
- [`tasks/`](tasks/) — working task list (`todo.md`) and log (`done.md`)

## Status (2026-07-18)

The digital v1 is implemented and passes the automated engine, persistence, build,
bundle-size, hot-seat, reload-resume, and two-browser online-game checks. The
human/external launch gates remain: the two physical couch playtests, device smoke
matrix, production DNS/service deployment, latency/crash/upgrade drills, and backup
restore drill. Those are tracked in [`tasks/todo.md`](tasks/todo.md).
