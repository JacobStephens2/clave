# Clave — A Partner Dance Game (Salsa)

[![CI](https://github.com/JacobStephens2/clave/actions/workflows/ci.yml/badge.svg)](https://github.com/JacobStephens2/clave/actions/workflows/ci.yml)

**Play it at [clave.dance](https://clave.dance).**

[playclave.com](https://playclave.com) also forwards there with a permanent
redirect through Porkbun. See [the forwarding record](ops/domain-forwarding.md)
for its settings and verification.

Clave is a cooperative card game for two players — a Lead and a Follow — who dance
a salsa song together, one 8-count at a time. Play positions, moves, and
flourishes, call for what you want next and answer what your partner asks for;
protect your Connection; finish the song with as much Style as you can. It is the
first entry in the planned _Partner Dance Game_ series.

v1 is a single responsive web app with a headless TypeScript engine, hot-seat
pass-and-play, and server-authoritative two-device rooms. The governing,
adjudicated build plan is [`docs/plans/clave-plan.md`](docs/plans/clave-plan.md).

## Features

- **Two ways to play:** hot-seat pass-and-play on one device, or a two-device room
  joined by a shared room code. Hot-seat games are saved in the browser after
  every accepted action; online rooms are saved transactionally in SQLite, and a
  reloaded device reclaims its seat and resumes the game.
- **Call and answer:** as your 8-count ends you either take the song card's bonus
  or make one of seven named **calls** over your partner's next 8-count. Answer it
  for Style and another link of **afinque** — the groove the couple builds by
  answering call after call — or drop it and lose Connection. Cover a call you
  can't answer with a Recovery card, take or **adjust the hold** to fix the floor
  you were left, and watch each 8-count land on one of five rungs: perfect, clean,
  awkward, recovered, break.
- **Guided turns:** the table walks each turn through Move → Position →
  Flourish, shows the standing call and whether your dance answers it yet,
  explains why a card can't be played on the current floor Position, and supports
  drag-and-drop as well as tap and keyboard play.
- **In-app rulebook:** a responsive **How to play** dialog on the home screen and
  live table — the call, afinque, the hold, and the ladder included — with balance
  values read from the same validated content as the engine.
- **Original card artwork** in an Afro-Caribbean figurative-expressionist style,
  repainted card by card with GPT Image 2.5; see
  [`docs/art/card-art-direction.md`](docs/art/card-art-direction.md).
- **Music and sound:** Clave bundles no music. The home screen and song banner
  open a link to the Llorarás recording on Spotify — the couple plays it on one
  speaker — and the copyrighted recording is never hosted or synchronized to
  turns. Card landings, calls, answers, drops, afinque links, lesson, turn,
  stumble, and finish cues are synthesized locally with the Web Audio API on
  **both** devices, with a separate SFX toggle that each device remembers.

## Play locally

Requires Node 22 or newer.

```sh
npm install
npm run dev
```

Open `http://localhost:5173`. The client and room server start together.
`npm run play` opens the same engine as a terminal game.

Verification commands (CI runs tests, typecheck, and the build
on every push and pull request):

```sh
npm test
npm run test:e2e
npm run typecheck
npm run lint
npm run build
```

## Application map

- `packages/content` — validated JSON cards, decks, balance values, and Llorarás song
- `packages/engine` — deterministic rules, legal actions, private snapshots, replay
- `packages/client` — responsive React PWA for hot-seat and online play
- `packages/server` — Hono/WebSocket rooms and transactional SQLite persistence
- `ops` — Apache/Caddy, systemd, verified backup, deploy-guard, and metric-query materials

## Repository map

- [`docs/rules/game-rules.md`](docs/rules/game-rules.md) — the rulebook (rules of record)
- [`docs/rules/decisions.md`](docs/rules/decisions.md) — rules decisions and rulings
- [`docs/cards/v1-card-list.md`](docs/cards/v1-card-list.md) — the complete v1 card set and the Llorarás song deck
- [`docs/plans/`](docs/plans/) — the v1 build plan, its adversarial review and adjudication, and the admin console plan
- [`docs/art/`](docs/art/) — card art direction and the generation prompts
- [`docs/audio/soundtrack.md`](docs/audio/soundtrack.md) — the four 2026-10-23/24
  attempts at an original instrumental soundtrack, the verification all four failed,
  and the licensing homework they leave for the next one
- [`docs/unity-vs-web-implementation-report.md`](docs/unity-vs-web-implementation-report.md) — comparison of Unity/Hearthstone-style and browser/BGA-style Clave development
- [`docs/living-documents/1-concept-brief.md`](docs/living-documents/1-concept-brief.md) — pitch, pillars, non-goals
- [`docs/living-documents/0-dance.md`](docs/living-documents/0-dance.md) — the Llorarás song/dance breakdown behind the v1 song deck
- [`docs/handwritten-notes/`](docs/handwritten-notes/) — journal scans and transcriptions the design grew from
- [`docs/clave-tech-stack.md`](docs/clave-tech-stack.md) — historical five-platform architecture study (post-v1 reference; superseded for v1 by the plan)
- [`docs/archive/`](docs/archive/) — superseded drafts and the original pre-production templates
- [`research/`](research/) — salsa music, dance, and game-design research notes
- [`tasks/`](tasks/) — working task list (`todo.md`) and log (`done.md`)

## Status (2026-10-24)

The digital v1 is deployed at [clave.dance](https://clave.dance) and passes the
automated engine, persistence, build, bundle-size, hot-seat, reload-resume, and
two-browser online-game checks. The call, afinque, the hold, and the resolution
ladder were added after v1 was measured; they are recorded as dated rulings in
[`docs/rules/decisions.md`](docs/rules/decisions.md) and as the plan's §9
amendment. The remaining launch gates are human and operational: the physical
couch playtests — now with the amended starter deck, the new Beginner Pose, and
the retuned song-card values — the device smoke matrix, and the
latency/crash/upgrade/restore drills. An authenticated room-administration
console is planned in
[`docs/plans/admin-ui-plan.md`](docs/plans/admin-ui-plan.md). All of these are
tracked in [`tasks/todo.md`](tasks/todo.md); bugs and feature work are tracked in
[GitHub issues](https://github.com/JacobStephens2/clave/issues).

## License

Copyright © 2026 Jacob Stephens. All rights reserved. The source, rules, and
artwork are published for reference only; no license to use, copy, modify, or
distribute them is granted. See [`LICENSE`](LICENSE).
