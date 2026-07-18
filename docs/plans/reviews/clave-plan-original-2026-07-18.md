# Plan: Clave — A Partner Dance Game (Salsa), v1

*Written 2026-07-18. Sources: `docs/rules/game-rules.md` (rules of record),
`docs/cards/v1-card-list.md`, `docs/rules/decisions.md`,
`docs/living-documents/1-concept-brief.md`, `docs/living-documents/0-dance.md`,
`docs/clave-tech-stack.md`, `9-project-context.md`, and Jacob's planning direction of
2026-07-18.*

## 1. Summary

Build a playable digital version of Clave — the cooperative two-player salsa card game
fully specified in `docs/rules/game-rules.md` — as a **single web application** that
runs in the browser on every device in the house (Android phones, MacBooks, Windows
laptops). The rules live in a **headless TypeScript engine** package; a small
self-hosted server provides two-device play on home Wi-Fi; a hot-seat mode makes the
game playable even earlier. The five-platform native architecture and Rust core in
`docs/clave-tech-stack.md` are deliberately deferred, with a concrete gate for
reviving them.

**Precedence note.** Jacob's 2026-07-18 direction ("one platform that suits the game,
v1 to play at home in the evenings") supersedes the five-platform scope of
`docs/clave-tech-stack.md` (2026-05-17) and the "Android primarily" line in the
concept brief. Where those documents describe *constraints* rather than scope — the
device-whitelisting constraint, the headless-logic and data-driven-content rules in
`9-project-context.md` — this plan keeps them.

## 2. Outcome and requirements

**Outcome.** Jacob and Mel can sit down on a weeknight, each open a URL on whatever
device is at hand, and play a complete game of Clave (the Llorarás song) together —
rules enforced, hands hidden, score tallied. The smallest version that delivers real
value is the Phase 2 hot-seat build: one device, pass-and-play, full rules.

### Success metrics (post-launch value, distinct from launch criteria in §6)

| ID | Metric | Baseline | Target | Window |
| --- | --- | --- | --- | --- |
| SM-1 | Completed two-player games at home | 0 (none exist) | ≥ 4 completed games (~1/week) | First 4 weeks after v1 launch |
| SM-2 | Completion rate: networked games reaching a rules-defined ending (song end or Connection 0) rather than abandonment | none measured | ≥ 70% | First 4 weeks after v1 launch |
| SM-3 | (Qualitative) Mel asks for a rematch unprompted | — | At least once | First 4 weeks |

SM-1/SM-2 are measured from the server's completed-game log (§6 Observability). SM-3
is a journal note, kept because it is the actual point of the project.

### Functional requirements

Rule-section references are to `docs/rules/game-rules.md`.

- **FR-1 Setup (§4):** role selection, 8-card starter decks, opening hand of 4 with
  the one-time mulligan, Connection 4 / Style 0 / $0, ordered 16-card Llorarás song
  deck, Beginner supply + Intermediate market of 3 + face-down Advanced deck.
- **FR-2 Turn loop (§5):** alternating turns Lead-first; per turn: +$1 and song-card
  reveal → dance → optional lesson → discard freely and draw to 4 with reshuffle on
  empty deck; phrase end after 8-counts 8 and 16 (score, clear table); game end after
  8-count 16.
- **FR-3 Dance rules (§6):** per-turn limits (≤2 Positions, ≤1 Move, ≤1 Flourish);
  opening an empty state with Position + matching Move; move-position matching;
  transition only immediately after a move; flourish only on this turn's move with
  matching tags; dance-the-basic; stumble (clear table, −2 Connection) with Return to
  Basic (−1) and Reconnect (−0) played from hand.
- **FR-4 Song bonuses (§7):** all 16 Llorarás song-card conditions from
  `docs/cards/v1-card-list.md`, applied immediately to the active player's 8-count.
- **FR-5 Phrase-end scoring (§7):** clean phrase +3, variety +1 per extra position,
  shared flair +2, pose finish +3; table cleared to owners' discard piles.
- **FR-6 Lessons (§8):** Beginner $1 / Intermediate $2 / Advanced $3 (montuno only);
  market refill on purchase; one private lesson per round (Lead turn + Follow turn);
  learn-from-partner once per phrase, free, from unlimited digital supply; bought
  cards go to discard.
- **FR-7 Signaling (§9):** hands hidden from partner at all times; a player may
  transiently reveal exactly one chosen card to their partner on their own turn.
- **FR-8 End of dance (§10):** immediate loss when Connection hits 0; final score =
  Style + Connection; rating table displayed.
- **FR-9 Hot-seat mode:** full game on one device, with a pass-the-device screen
  between turns so hands stay private.
- **FR-10 Two-device play:** create a room, share a join code, pick roles, play with
  every action validated server-side.
- **FR-11 Resume:** a page refresh, dropped connection, or server restart mid-game
  loses no committed action; a player rejoins their seat and continues within seconds.
- **FR-12 Playability aids:** playable cards and legal actions visibly indicated;
  current song card and its bonus always visible; Connection, Style, money, phrase
  position, and market state always visible; scrollable game log.
- **FR-13 Undo:** a player may undo their own plays within the current turn, up to
  turn start. (Co-op game: the market-refill information leak on undoing a purchase
  is accepted — record in `docs/rules/decisions.md`.)
- **FR-14 Deployed access:** the game is reachable at a stable HTTPS URL from all
  three home device classes, with a PWA manifest so it can sit on a phone home
  screen.

### Nonfunctional requirements

- **NFR-1 Device coverage:** fully playable on current Chrome on Android (viewport ≥
  360 CSS px wide, portrait), Safari ≥ 17 on macOS, and current Edge or Chrome on
  Windows. Verified by the Phase 4 smoke matrix.
- **NFR-2 Responsiveness:** action submitted → both screens updated in < 500 ms p95
  on home Wi-Fi.
- **NFR-3 Resume speed:** reconnect after refresh or drop restores exact game state
  in < 5 s.
- **NFR-4 Determinism:** same seed + same action log + same content version →
  byte-identical serialized final state, on 100% of the golden-replay corpus, on
  every test run.
- **NFR-5 Payload:** initial JS bundle < 500 KB gzipped (no WASM, no engine
  runtime — comfortably achievable, enforced by a CI size check so it stays true).
- **NFR-6 Durability:** no committed action is lost on server crash (event log
  flushed per action); availability itself is best-effort — this is a household
  service.

### Non-goals (v1)

- Native clients of any kind (Android/iOS/macOS/Windows) — no UniFFI, no bindings.
- Offline P2P (Nearby Connections / Multipeer) — the flights use case is deferred;
  home Wi-Fi is assumed.
- AI partner / single-player; accounts, matchmaking, spectators; analytics beyond a
  completed-game counter.
- In-app music playback. No bundling of the Oscar D'León recording (rights) and no
  original soundtrack yet; the couple plays the track on a speaker. The song deck
  structure already carries the musical arc.
- Additional songs and dance styles, and the general content-pack/fusion machinery.
  Content stays data-driven (see D6) so a second song is cheap later, but no
  multi-style abstraction is built.
- Turn timers (the tech-stack doc mentions them; the rulebook has none — rulebook
  wins).
- The §11 no-lessons variant — cheap later (decks already defined), not v1.

### Constraints and assumptions

- Solo developer (Jacob), evenings, with Claude Code as the primary implementation
  tool; Mel is the co-playtester.
- **Device whitelisting** (documented in `docs/clave-tech-stack.md` §12): installing
  native apps on the household devices requires a per-build permission ask. Browser
  delivery bypasses this entirely. This constraint is decisive for D1.
- Development on the Mac; the Linux server (the machine currently serving
  stephens.page) is the deployment target — internet-reachable, confirmed
  2026-07-18. Domains `clave.dance` and `playclave.com` are registered on Porkbun.
- No budget beyond what already exists (domain/server assumed already paid for).
- Intentionally thin sections, given a two-person-audience home project: compliance
  (none applies), monetization (none), accessibility (basic touch-target and contrast
  hygiene only), analytics (a game counter).

## 3. Design decisions

**D1. Platform: a single responsive web app (installable PWA).**
Alternatives: native Android with Compose (concept brief's original platform); Godot
(one codebase exporting everywhere); Flutter. Chosen because it is the only option
that (a) runs on *every* device in the house — Android phones, MacBooks, Windows
laptops — from one codebase, (b) bypasses the device-whitelisting install friction
entirely (refresh the tab = new build; this killed native-first in the tech-stack
doc's own analysis), and (c) fits the game: a turn-based card game with a
"tabletop, not animation" pillar needs good text/layout/touch UI, which the DOM does
better than a game engine. Native Android would cover only the phones and reintroduce
the whitelisting ask on every build; Godot/Flutter add an engine and a language
without adding a device the web doesn't already reach.

**D2. Rules engine: a headless TypeScript package; Rust deferred behind a gate.**
Alternatives: Rust core + wasm-bindgen now (the tech-stack doc's architecture); no
separation at all (rules inside React components). The middle path keeps what was
valuable about the "headless core" idea — rules/UI separation, determinism, one
source of truth, testability, and `9-project-context.md`'s standing rule that logic
is decoupled from rendering — while dropping its expensive part, the cross-language
FFI toolchain, which only pays off when a second *language* consumes the core. The
engine exposes the same coarse-grained API shape the tech doc specified
(`applyAction`, `legalActions`, `snapshotFor`, replay), is event-sourced and
seedable, and ships with a **golden-replay corpus** (seed + action log + expected
final-state hash as JSON fixtures). That corpus is the portability insurance: a
future Rust port must reproduce it byte-for-byte, making the rewrite a mechanical,
verifiable task (~a few thousand lines of reducer logic). **Gate to revive Rust:** a
native client (Android P2P for flights, or any App Store target) is actually
scheduled — not before.

**D3. Multiplayer: server-authoritative WebSocket rooms, event-sourced; hot-seat as
a first-class mode.** Alternatives: WebRTC P2P (no server to run, but NAT traversal
still needs a signaling host, and mid-game resume is much harder); a hosted realtime
backend like Firebase/Supabase (vendor dependency and account plumbing for a
two-user game). Chosen because the server is trivial to operate on hardware Jacob
already owns, reuses the engine verbatim for validation, and makes FR-11 resume
nearly free: a game *is* `(seed, action log)`, so rejoin and crash-recovery are both
"replay the log." Hidden hands are enforced at this boundary — each client receives
only its own role's snapshot. Hot-seat mode runs the same engine fully client-side,
so an evening game is never blocked by netcode.

**D4. Client stack: React + TypeScript (strict) + Vite + Tailwind, Zustand for
client state.** Alternatives: Svelte (fine, but no existing docs momentum); plain TS
(more code for no benefit). This matches the tech-stack doc's web column minus the
WASM plumbing, so prior thinking carries over. Explicitly *not* adopted until a need
appears: a router (two screens), Framer Motion, TanStack Query. Boring, mainstream,
stable tooling as of this writing; exact versions pinned in Phase 0.

**D5. Server stack: Node LTS + Hono (HTTP + static) + `ws` (WebSocket), SQLite via
`better-sqlite3` for the per-room event log.** Alternatives: Axum/Rust (the tech doc's
server — wrong side of D2 now); Postgres (operational overhead with no requirement
behind it). One process, one file-backed database, systemd-managed.

**D6. Content as data: cards, decks, and the song deck live in JSON validated by zod
schemas against `docs/cards/v1-card-list.md`.** Song bonuses use a small
condition/effect DSL (~12 condition ops cover all 16 Llorarás cards: move-style
thresholds, danced-from position, flourish/pose played, position changed, cards
played ≥ N, ends-in-position, same-position-as-previous-move, partner-history
lookups). This honors `9-project-context.md`'s data-driven rule and makes tuning and
a second song a data task, not a code task. Balance numbers are never hardcoded in
the engine.

**D7. Audio: out of the app for v1.** Alternatives: bundle the recording (licensing
problem, even for a private deploy it means distributing the file); commission/
generate an original track (scope). Playing the record on a speaker next to the
table is the v1 experience; the song deck already sequences the music's structure.

**D8. Hosting: the stephens.page Linux server behind Caddy with automatic TLS, at
`clave.dance`, as a systemd service.** Resolved 2026-07-18: the server is
internet-reachable and `clave.dance` + `playclave.com` are registered on Porkbun.
Primary domain: `clave.dance` (short, on-theme); `playclave.com` becomes a 301
redirect (one extra Caddy block). DNS: an A record pointing at the server —
Porkbun's own DNS or Cloudflare in DNS-only (grey-cloud) mode both work identically;
keep the record unproxied so Caddy's Let's Encrypt issuance stays zero-config.
Cloudflare's orange-cloud proxy is a later option (hides the server IP) at the cost
of switching Caddy to a DNS challenge or origin certs — no requirement for it in v1.
Alternatives considered: LAN-only hosting on the Mac (works for home play but adds a
"is the laptop awake" failure mode and no stable URL); Cloudflare Pages + Workers
(splits the stack and can't run the WebSocket room server as designed).

## 4. Architecture

### Components

- **`packages/engine`** — headless TS. Owns: card/deck/market/song types and state;
  the action set (play position/move/flourish, basic, stumble with optional recovery,
  buy lesson, learn-from-partner, signal-reveal, freshen-up/end-turn, mulligan,
  undo); `applyAction(state, action) → state | RuleError`; `legalActions(state,
  role)`; `snapshotFor(state, role)` (hides partner hand and both deck orders);
  phrase/song scoring; seeded PRNG (seed in initial state; RNG used only for
  shuffles); replay from `(seed, contentVersion, actions[])`. No DOM, no I/O, no
  wall-clock.
- **`packages/content`** — `cards.json`, deck/supply definitions, `song-lloraras.json`,
  zod schemas, and a consistency check that asserts counts against the card-list doc
  (22-card Intermediate deck, 6-card Advanced deck, 8-card starters, 16 song cards).
- **`packages/client`** — React PWA. Screens: Home (new hot-seat game / create room /
  join room, role pick) and Match (table: dance state + current song card top;
  Connection/Style/money/phrase HUD; markets; own hand fanned bottom; log; pass
  screen in hot-seat). Renders from `PlayerSnapshot` only.
- **`packages/server`** — room lifecycle (create/join by unguessable code), applies
  actions through the engine, appends to the SQLite event log, broadcasts per-role
  snapshots, session tokens in localStorage for seat reclaim.

### Data model

`ContentSet` (versioned by content hash) → `Game` (seed, contentHash, ordered
`actions[]`; state is derived, never stored authoritatively) → `Room` (code, game,
two seat tokens, created/last-active timestamps). Growth is bounded: a game is ~120
actions; rooms expire and are deleted after 30 days.

### Trust boundaries and threat model

The server is the authority: clients submit actions with a sequence number; the
server rejects illegal actions (engine says so) and stale sequence numbers
(idempotent retries are safe). Hidden information never leaves the server except in
the owning player's snapshot — hand privacy is structural, not cosmetic.

Threat model beyond that: **not material.** No accounts, no PII, no payments, two
known users. Controls anyway: 128-bit random room codes, TLS via Caddy, a cap on
concurrent rooms and creation rate, room expiry. Accepted residual risk: DoS against
a hobby box (recovery: restart; nothing of value is lost — NFR-6 covers state).

### Dependencies and failure domains

External runtime dependencies: none (no third-party APIs, no CDN assets — fonts and
art self-hosted). Failure handling: WebSocket drop → client auto-reconnects with
backoff and reclaims its seat by token (FR-11); server crash → systemd restarts,
rooms rehydrate by replaying event logs; SQLite file loss → nightly `cp` backup via
cron (worst case: lose in-flight games, acceptable). Client refresh mid-turn →
snapshot restores exactly. Fails closed: if the server can't validate, the action is
rejected, never guessed.

### Concurrency and time

Turn-based with a single active player; the server serializes actions per room, so
there are no write races by construction. No wall-clock anywhere in rules (no turn
timers in v1). Timezones: irrelevant. Hot-seat mode runs the engine in-browser with
the same action log format, so a hot-seat game could even be resumed as a networked
one later (not a requirement, just a property of the design).

### Paths most likely to hurt

Not performance (the whole game state is a few KB; NFR-2 is generous) but
**rulebook-edge-case correctness**: phrase-boundary interactions, stumble-turn
semantics (may the stumbling player still buy a lesson? §6 says only "no other dance
cards" — engine will treat lesson/freshen as allowed and record it in
`docs/rules/decisions.md`), song_010/014 partner-history tracking, variety-bonus
position accounting. These are exactly what the Phase 1 test suite is aimed at.

## 5. Delivery phases

Ordering rationale: the biggest risk to this project is not technical — it is that
the game, as specified, isn't fun enough to survive contact with a real Tuesday
evening, or that the rulebook has holes that surface as table arguments. Phase 1
(engine against the full rulebook) surfaces the holes; Phase 2 (hot-seat) gets the
game onto the living-room couch at the earliest possible moment, before any
networking exists. Netcode, the most expendable part, comes after the fun is proven.

### Phase 0 — Scaffold and content (1–2 evenings, high confidence)

Scope: npm-workspaces monorepo (`engine`, `content`, `client`, `server`), TS strict,
Vitest, ESLint/Prettier, CI running tests + bundle-size check; author `cards.json` and
`song-lloraras.json` from `docs/cards/v1-card-list.md` with zod validation and the
doc-consistency check; add a "superseded for v1 by this plan" banner to
`docs/clave-tech-stack.md` so future Claude Code sessions don't build toward five
platforms. Delivers: build passes, content tests green. **Gate:** `npm test` green
including content-vs-doc count assertions.

### Phase 1 — The engine, complete against the rulebook (8–14 evenings, medium confidence)

Scope: FR-1 through FR-8 and FR-13 as pure engine logic; NFR-4. Test suite organized
by rulebook section (`setup.test.ts` ↔ §4, `dancing.test.ts` ↔ §6, …); property
tests with fast-check (every action from `legalActions` applies cleanly; no illegal
state reachable — Connection stays 0–10, hand ≤ 4 at turn end, Lead-first
invariant; replay round-trips); golden-replay corpus of ≥ 5 full games including a
Connection-0 loss, a stumble-heavy game, and a max-lessons game. A tiny CLI runner
(`npm run play`) makes the engine playable in-terminal for smoke-feel. Every
ambiguity discovered is resolved and appended to `docs/rules/decisions.md` (and the
rulebook amended) — that output is a deliverable, not a side effect. **Gate:** all
rulebook sections have named passing tests; determinism corpus passes; ambiguity list
written back to docs. Parallelism: client screen skeletons (Phase 2) may start
against snapshot fixtures once `PlayerSnapshot` stabilizes mid-phase.

### Phase 2 — Hot-seat client: the game reaches the couch (8–12 evenings, medium confidence)

Scope: FR-9, FR-12, and the UI surface of FR-1–FR-8 and FR-13; engine runs
in-browser; pass-the-device screen guards hand privacy; phone-portrait layout first,
laptop layout second. Playwright script drives one full scripted game. Delivers: the
first real playtest with Mel — v1's actual value, ahead of any networking.
**Gate:** a complete Llorarás game played pass-and-play on one Android phone and on a
MacBook; Playwright full-game spec green; at least one human playtest logged with
notes.

### Phase 3 — Server and two-device play (5–9 evenings, medium confidence)

Scope: FR-10, FR-11, FR-7 across devices; NFR-2, NFR-3, NFR-6. Rooms, seat tokens,
per-role snapshot broadcast, reconnect, SQLite event log, crash rehydration.
Playwright two-browser-context E2E playing a full game including a mid-game reload of
one context. **Gate:** full game on two physical devices on home Wi-Fi (server on the
Mac is fine here), with one deliberate mid-game refresh and one deliberate server
restart, both recovered losslessly.

### Phase 4 — Deploy and finish (3–5 evenings, high confidence)

Scope: FR-14, NFR-1, NFR-5; point `clave.dance` DNS at the stephens.page server,
Caddy + systemd, `playclave.com` → 301 redirect (per D8); PWA manifest + icons;
smoke matrix across the three device classes; nightly DB-file backup cron;
completed-game counter query documented. **Gate = launch
criteria (§6).** Rollout/migration: greenfield with no users, so every step is
reversible (git revert + redeploy); no irreversible steps exist in this plan.

### Phase 5 — Post-v1 menu (unscheduled, pick by appetite after the §6 review)

No-lessons variant (§11 — decks already defined); a second song deck (data-only, per
D6); original soundtrack + in-app audio; AI partner for solo practice; and — only if
its gate fires (D2) — the Rust core port validated against the golden-replay corpus,
followed by the native clients from `docs/clave-tech-stack.md`.

**Estimate summary:** 25–42 evenings total; at 3–4 evenings/week, roughly 7–12 weeks
to v1. Assumes Claude Code does the heavy lifting, no design pivot mid-build, and
rules ambiguities are resolved by decision (cheap) rather than redesign (expensive).
Upper bounds are low-confidence in Phase 1–2 if the Phase 2 playtest forces rules
changes — mitigated by tuning numbers living in content JSON.

## 6. Validation and operations

**Test levels.** Engine unit tests (per rulebook section, the primary safety net);
property tests (action legality, invariants, replay determinism); content tests
(schema + doc-count consistency); E2E via Playwright (hot-seat full game; two-context
online game with reload); manual smoke matrix (Android Chrome portrait, macOS Safari,
Windows Edge) at Phase 4; and the human playtests, logged in `tasks/scratch.md` or a
playtest log.

**Traceability.**

| Req | Phase | Verified by |
| --- | --- | --- |
| FR-1 | 1 | `engine/tests/setup.test.ts` |
| FR-2 | 1 | `engine/tests/turn-loop.test.ts` |
| FR-3 | 1 | `engine/tests/dancing.test.ts` + property suite |
| FR-4 | 1 | `engine/tests/song-bonuses.test.ts` (one case per song card) |
| FR-5 | 1 | `engine/tests/phrase-scoring.test.ts` |
| FR-6 | 1 | `engine/tests/lessons.test.ts` |
| FR-7 | 1, 3 | `engine/tests/visibility.test.ts` (snapshot filtering); online E2E |
| FR-8 | 1 | `engine/tests/endgame.test.ts` |
| FR-9 | 2 | Playwright `hotseat.spec.ts` + Phase 2 gate playtest |
| FR-10 | 3 | Playwright `online.spec.ts` |
| FR-11 | 3 | `online.spec.ts` reload step + Phase 3 restart drill |
| FR-12 | 2 | `hotseat.spec.ts` assertions + playtest checklist |
| FR-13 | 1, 2 | `engine/tests/undo.test.ts`; UI path in `hotseat.spec.ts` |
| FR-14 | 4 | Phase 4 smoke matrix on deployed URL |
| NFR-1 | 4 | Smoke matrix |
| NFR-2 | 3 | Timed assertion in `online.spec.ts` (LAN) |
| NFR-3 | 3 | Reconnect drill with stopwatch assertion |
| NFR-4 | 1 | Golden-replay corpus in CI |
| NFR-5 | 0, 4 | CI bundle-size check |
| NFR-6 | 3 | Kill-server-mid-game drill |

**Observability.** Structured server logs (room lifecycle, rejected actions,
reconnects); `/healthz`; completed games queryable from SQLite (feeds SM-1/SM-2). No
alerting — the pager is Mel saying the game is down. This is intentionally thin.

**Launch criteria** (all must hold): every engine test and the determinism corpus
green in CI; a complete two-device game played over the deployed HTTPS URL from an
Android phone and a MacBook; the reconnect and server-restart drills pass on the
deployed instance; no known bug that blocks finishing a game.

**Post-launch review.** Four weeks after launch, read SM-1/SM-2/SM-3 against
targets; Jacob decides: iterate (Phase 5 items), fix friction, or stop. Ownership and
ops: Jacob; backups nightly cron; upgrades are `git pull` + service restart.

## 7. Risks and pre-mortem

1. **"We built platform, not game."** Relapse into the five-platform/Rust
   architecture before the game is proven fun. *Mitigation:* D2's explicit gate;
   Phase 0 banner on the tech-stack doc. *Early warning:* any FFI, binding, or
   second-language work appearing in `tasks/todo.md` before Phase 4 is done.
2. **"It wasn't fun on a phone."** Thirty minutes of rules administration kills the
   evening. *Mitigation:* hot-seat playtest at the earliest possible phase (2);
   tuning lives in JSON; FR-12 aids (legal-play highlighting) reduce cognitive load.
   *Early warning:* the Phase 2 playtest isn't finished, or Mel doesn't want a second
   game (SM-3's inverse).
3. **"Netcode ate the project."** Reconnect edge cases consume weeks. *Mitigation:*
   event-sourced authoritative server makes resume "replay the log"; hot-seat remains
   a complete fallback so evening play never depends on Phase 3 finishing.
4. **"The evenings stopped."** Motivation stall mid-Phase-1 with nothing visible.
   *Mitigation:* the CLI runner makes the engine playable early; phases each end in
   something usable; `tasks/todo.md` keeps re-entry cost low after a gap.
5. **"The app and the rulebook disagree."** Table disputes because the engine
   silently diverged from `game-rules.md`. *Mitigation:* tests named by rulebook
   section; every ambiguity resolution written back to `docs/rules/decisions.md` and
   the rulebook in the same commit.

Internal-consistency check: this plan contradicts `docs/clave-tech-stack.md` (scope)
and the concept brief's platform line by design — both are handled by the precedence
note in §1 and the Phase 0 banner task, not left as silent drift.

## 8. Open questions

All three original open questions were resolved on 2026-07-18; none remain.

| ID | Question | Resolution (2026-07-18) |
| --- | --- | --- |
| OQ-1 | Is the Linux server internet-reachable with a domain for Caddy auto-TLS? | **Resolved.** Reachable (it serves stephens.page). `clave.dance` is primary, `playclave.com` redirects; DNS via Porkbun or Cloudflare DNS-only. Details in D8. |
| OQ-2 | Stumble-turn semantics: may the stumbling player still take a lesson and freshen up? | **Resolved: yes.** A stumble replaces only turn step 2 (Dance); steps 1, 3, and 4 proceed. Rationale: §6's literal text ("no other *dance* cards"), avoiding a bad-hand death spiral, and the "recovery is a skill" pillar — freshen-up is exactly what a stumbling player needs. The stumble's 2-Connection cost plus a Style-less 8-count is sufficient punishment. To be recorded in `docs/rules/decisions.md` (and §6 clarified) during Phase 1. |
| OQ-3 | Is speaker-played music acceptable for v1 evenings (no in-app audio)? | **Resolved: yes**, confirmed by Jacob. D7 stands. |
