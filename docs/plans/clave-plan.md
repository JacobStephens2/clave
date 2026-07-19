# Plan: Clave — A Partner Dance Game (Salsa), v1

*Revision 2, 2026-07-18 — adjudicated after adversarial review
(`docs/plans/reviews/clave-plan-adversarial-review-2026-07-18.md`; adjudication:
`docs/plans/reviews/clave-plan-adjudication-2026-07-18.md`; the pre-adjudication
original is preserved as `docs/plans/reviews/clave-plan-original-2026-07-18.md`).
Sources: `docs/rules/game-rules.md` (rules of record), `docs/cards/v1-card-list.md`,
`docs/rules/decisions.md`, `docs/living-documents/1-concept-brief.md`,
`docs/living-documents/0-dance.md`, `docs/clave-tech-stack.md`, the architecture
rules now in `CLAUDE.md` (formerly `9-project-context.md`, archived under
`docs/archive/templates/`), and Jacob's planning direction of 2026-07-18.*

## 1. Summary

Build a playable digital version of Clave — the cooperative two-player salsa card game
fully specified in `docs/rules/game-rules.md` — as a **single web application** that
runs in the browser on every device in the house (Android phones, MacBooks, Windows
laptops). The rules live in a **headless TypeScript engine** package; a small
self-hosted server provides two-device play on home Wi-Fi; a hot-seat mode makes the
game playable even earlier. Before any code, a **physical-prototype couch gate**
validates the game itself — the project's single biggest risk — for the cost of one
or two evenings. The five-platform native architecture and Rust core in
`docs/clave-tech-stack.md` are deliberately deferred, with a concrete gate for
reviving them.

**Precedence note.** Jacob's 2026-07-18 direction ("one platform that suits the game,
v1 to play at home in the evenings") supersedes the five-platform scope of
`docs/clave-tech-stack.md` (2026-05-17) and the "Android primarily" line in the
concept brief. Where those documents describe *constraints* rather than scope — the
device-whitelisting constraint, the headless-logic and data-driven-content rules
(formerly `9-project-context.md`, now the Architecture rules in `CLAUDE.md`) —
this plan keeps them. Phase 0 updates the repository's root documents so no other
file still claims authority it no longer has.

## 2. Outcome and requirements

**Outcome.** Jacob and Mel can sit down on a weeknight, each open a URL on whatever
device is at hand, and play a complete game of Clave (the Llorarás song) together —
rules enforced, hands hidden, score tallied. The smallest version that delivers real
value is the Phase 0 physical prototype (playable in week one); the smallest
*digital* version is the Phase 3 hot-seat build.

### Success metrics (post-launch value, distinct from launch criteria in §6)

| ID | Metric | Baseline | Target | Window |
| --- | --- | --- | --- | --- |
| SM-1 | Completed two-player games at home (networked + hot-seat) | 0 (none exist) | ≥ 4 completed games (~1/week) | First 4 weeks after v1 launch |
| SM-2 | Completion rate: started games reaching a rules-defined ending (song end or Connection 0) rather than abandonment | none measured | ≥ 70% | First 4 weeks after v1 launch |
| SM-3 | (Qualitative) Mel asks for a rematch unprompted | — | At least once | First 4 weeks |

SM-1 and SM-2 are computed from the durable game-event model defined in §6
(Observability): `game_started` provides SM-2's denominator, terminal events
(`completed`, `lost`, `abandoned`, `unresumable`) its numerator classes, and
hot-seat games report completions via a beacon so SM-1 counts them. SM-3 is a
journal note, kept because it is the actual point of the project.

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
  Basic (−1) and Reconnect (−0) played from hand. Per the 2026-07-18 ruling: a
  stumble replaces only turn step 2 (Dance); steps 1, 3, and 4 proceed normally.
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
- **FR-11 Resume:** no committed action is ever lost to a page refresh, dropped
  connection, mobile tab eviction, server crash, or server restart. Networked games
  resume from the server's event log; hot-seat games resume from a locally
  persisted envelope (localStorage, written after every committed action). A deploy
  that changes engine semantics or content resumes active rooms from their stored
  state snapshot (see §4 Resume envelope); a room that cannot be safely resumed is
  explicitly declared unresumable to the players — never silently replayed against
  changed rules.
- **FR-12 Playability aids:** playable cards and legal actions visibly indicated;
  current song card and its bonus always visible; Connection, Style, money, phrase
  position, and market state always visible; scrollable game log.
- **FR-13 Undo:** a player may undo their own plays within the current turn, up to
  turn start. (Co-op game: the market-refill information leak on undoing a purchase
  is accepted — recorded in `docs/rules/decisions.md` during Phase 2.)
- **FR-14 Deployed access:** the game is reachable at `https://clave.dance` from all
  three home device classes, with a PWA manifest so it can sit on a phone home
  screen; `playclave.com` 301-redirects there.

### Nonfunctional requirements

- **NFR-1 Device coverage:** fully playable on current Chrome on Android (viewport ≥
  360 CSS px wide, portrait), Safari ≥ 17 on macOS, and current Edge or Chrome on
  Windows. Verified by the Phase 5 deployed smoke matrix on all three device
  classes — the launch checklist includes all three, not a subset.
- **NFR-2 Responsiveness:** action submitted → both screens updated in < 500 ms p95,
  measured over a full scripted game (≥ 100 actions, post-warm-up) through the
  deployed path, with p50/p95/max recorded. A single timed assertion does not
  establish a percentile and does not satisfy this requirement.
- **NFR-3 Resume speed:** reconnect after refresh or drop restores exact game state
  in < 5 s.
- **NFR-4 Determinism:** same seed + same action log + same content bytes + same
  engine version → byte-identical serialized final state, on 100% of the
  golden-replay corpus, on every test run. Rehydration in production re-verifies
  this per room (§4).
- **NFR-5 Payload:** initial JS bundle < 500 KB gzipped, enforced by a CI size
  check.
- **NFR-6 Durability:** no committed action is lost on server crash (log append and
  state snapshot are committed in one SQLite transaction before broadcast);
  durability spans deploys per FR-11; availability itself is best-effort — this is a
  household service.

### Non-goals (v1)

- Native clients of any kind (Android/iOS/macOS/Windows) — no UniFFI, no bindings.
- Offline P2P (Nearby Connections / Multipeer) — the flights use case is deferred;
  home Wi-Fi is assumed.
- AI partner / single-player; accounts, matchmaking, spectators; analytics beyond
  the §6 game-event model.
- In-app music playback, and **music synchronization of any kind**. No bundling of
  the Oscar D'León recording (rights) and no original soundtrack yet. Playback is
  ambient (see D7): the couple plays the track on a speaker; the game is turn-based
  and untimed; the rulebook's "8-count" is a thematic game unit, not a literal
  synchronized span of the recording.
- Additional songs and dance styles, and the general content-pack/fusion machinery.
  Content stays data-driven (see D6) so a second song is cheap later, but no
  multi-style abstraction is built.
- Turn timers (the tech-stack doc mentions them; the rulebook has none — rulebook
  wins).
- The §11 no-lessons variant — cheap later (decks already defined), not v1.
- Automated cross-version deployment test matrices (N→N+1→N CI pipelines),
  bidirectionally compatible schema migrations, version-adapter layers for old
  replays. At household scale these are replaced by the resume envelope, the
  deploy guard, and one manual upgrade drill (§4, Phase 4/5).

### Constraints and assumptions

- Solo developer (Jacob), evenings, with Claude Code as the primary implementation
  tool; Mel is the co-playtester.
- **Device whitelisting** (documented in `docs/clave-tech-stack.md` §12): installing
  native apps on the household devices requires a per-build permission ask. Browser
  delivery bypasses this entirely. This constraint is decisive for D1.
- Development on the Mac; the Linux server (the machine currently serving
  stephens.page) is the deployment target — internet-reachable, confirmed
  2026-07-18. Domains `clave.dance` and `playclave.com` are registered on Porkbun.
- `docs/cards/v1-card-list.md` defines physical-prototype copy counts by design —
  the Phase 0 couch gate uses them directly.
- No budget beyond what already exists (domains/server already paid for).
- Intentionally thin sections, given a two-person-audience home project: compliance
  (none applies), monetization (none), accessibility (basic touch-target and
  contrast hygiene only), analytics (the §6 game-event model only).

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
source of truth, testability, and the repo's standing rule (`CLAUDE.md`) that logic
is decoupled from rendering — while dropping its expensive part, the cross-language
FFI toolchain, which only pays off when a second *language* consumes the core. The
engine exposes the same coarse-grained API shape the tech doc specified
(`applyAction`, `legalActions`, `snapshotFor`, replay), is event-sourced and
seedable, and ships with a **golden-replay corpus** (seed + action log + content
bytes + expected final-state hash as JSON fixtures). That corpus is the portability
insurance: a future Rust port must reproduce it byte-for-byte, making the rewrite a
mechanical, verifiable task. **Gate to revive Rust:** a native client (Android P2P
for flights, or any App Store target) is actually scheduled — not before.

**D3. Multiplayer: server-authoritative WebSocket rooms, event-sourced, carried in a
versioned resume envelope; hot-seat as a first-class mode.** Alternatives: WebRTC
P2P (no server to run, but NAT traversal still needs a signaling host, and mid-game
resume is much harder); a hosted realtime backend like Firebase/Supabase (vendor
dependency and account plumbing for a two-user game). Chosen because the server is
trivial to operate on hardware Jacob already owns, reuses the engine verbatim for
validation, and makes FR-11 resume nearly free. **A game is not merely
`(seed, action log)`** — replay also depends on the exact content bytes and engine
semantics, so the persisted unit is the **resume envelope** (§4): engine version,
content bytes, seed, action log, and the latest state snapshot, kept together for
the life of the room. Hidden hands are enforced at the server boundary — each client
receives only its own role's snapshot. Hot-seat mode runs the same engine fully
client-side and persists the same envelope to localStorage, so an evening game is
never blocked by netcode and never lost to a tab eviction.

**D4. Client stack: React + TypeScript (strict) + Vite + Tailwind, Zustand for
client state.** Alternatives: Svelte (fine, but no existing docs momentum); plain TS
(more code for no benefit). This matches the tech-stack doc's web column minus the
WASM plumbing, so prior thinking carries over. Explicitly *not* adopted until a need
appears: a router (two screens), Framer Motion, TanStack Query. Boring, mainstream,
stable tooling as of this writing; exact versions pinned in Phase 1.

**D5. Server stack: Node LTS + Hono (HTTP + static) + `ws` (WebSocket), SQLite via
`better-sqlite3` for the per-room envelope store.** Alternatives: Axum/Rust (the
tech doc's server — wrong side of D2 now); Postgres (operational overhead with no
requirement behind it). One process, one file-backed database, systemd-managed.
Operational specifics adopted after review: the database schema is versioned with
`PRAGMA user_version` and migrations are forward-only; **backups use SQLite's
supported consistent-copy mechanism (`VACUUM INTO` to a temporary file, verified
with `PRAGMA integrity_check`, then atomically rotated), never a raw `cp` of the
live file** — SQLite's own documentation warns that copying a live database can
capture a torn, corrupt state and that DB/WAL files must stay paired
(sqlite.org "How To Corrupt An SQLite Database File" / Backup API, verified
2026-07-18). Rollback story: restore the latest verified backup; documented, and
drilled once in Phase 5.

**D6. Content as data: cards, decks, and the song deck live in JSON validated by zod
schemas against `docs/cards/v1-card-list.md`.** Song bonuses use a small
condition/effect DSL (~12 condition ops cover all 16 Llorarás cards: move-style
thresholds, danced-from position, flourish/pose played, position changed, cards
played ≥ N, ends-in-position, same-position-as-previous-move, partner-history
lookups). This honors the repo's data-driven rule (`CLAUDE.md`) and makes tuning and
a second song a data task, not a code task. Balance numbers are never hardcoded in
the engine. Content is hashed (SHA-256 over a canonical serialization with stable
key order), and the bytes travel with every game's resume envelope so tuning
releases can never corrupt a game in progress.

**D7. Audio: out of the app, and explicitly ambient — the game does not synchronize
with the recording.** Alternatives: bundle the recording (licensing problem, even
for a private deploy it means distributing the file); commission/generate an
original track (scope); synchronized playback (rejected — the rulebook defines a
turn-based, untimed game of 16 thematic "8-counts", while the actual recording is
3:42 ≈ 89 musical 8-counts per `0-dance.md`; a ~30-minute game cannot track a
4-minute track, and no requirement asks it to). The v1 experience: play the record
on a speaker — once, looped, or as a playlist, at the couple's whim — while the
song *deck* sequences the arc of the song thematically. The Phase 0 couch gate
tests exactly this experience before any code exists. Confirmed acceptable by
Jacob, 2026-07-18.

**D8. Hosting: the stephens.page Linux server behind its existing Apache reverse
proxy with Certbot TLS, at `clave.dance`, as a systemd service.** Resolved
2026-07-18 and corrected from the assumed Caddy frontend on 2026-07-19 after the
live server identified itself as Apache 2.4.58: the server is internet-reachable
and `clave.dance` + `playclave.com` are registered on Porkbun. Primary domain:
`clave.dance` (short, on-theme); `playclave.com` becomes a 301 redirect after its
apex and `www` records are pointed away from Porkbun parking. DNS: an A record
pointing at the server — Porkbun's own DNS or Cloudflare in DNS-only (grey-cloud)
mode both work identically. Cloudflare's orange-cloud proxy is a later option
(hides the server IP) at the cost of an additional proxy layer — no requirement
for it in v1. A Caddy template remains available for a fresh host, but replacing
the server's working Apache frontend only for Clave would add avoidable launch
risk.
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
  shuffles); replay from an envelope. Exports **`ENGINE_VERSION`**, an integer
  bumped on any change to reducer semantics, the action schema, or the state
  schema — the versioning contract for FR-11. All schemas (action, state, content)
  are zod-defined; serialization is canonical (stable key order) so hashes are
  meaningful. No DOM, no I/O, no wall-clock.
- **`packages/content`** — `cards.json`, deck/supply definitions,
  `song-lloraras.json`, zod schemas, and a consistency check that asserts counts
  against the card-list doc (22-card Intermediate deck, 6-card Advanced deck,
  8-card starters, 16 song cards).
- **`packages/client`** — React PWA. Screens: Home (new hot-seat game / create room /
  join room / resume, role pick) and Match (table: dance state + current song card
  top; Connection/Style/money/phrase HUD; markets; own hand fanned bottom; log; pass
  screen in hot-seat). Renders from `PlayerSnapshot` only. Hot-seat games persist
  their envelope to localStorage after every committed action and offer resume on
  load. On joining a networked room, the client sends its engine/protocol version;
  on mismatch with the server it prompts a reload rather than playing with stale
  code.
- **`packages/server`** — room lifecycle (create/join by unguessable code), applies
  actions through the engine, persists the envelope transactionally, broadcasts
  per-role snapshots, session tokens in localStorage for seat reclaim, and emits
  the §6 game events.

### Data model and the resume envelope

The persisted unit for every game — server rooms and hot-seat alike — is the
**resume envelope**:

```
{ engineVersion, contentHash, contentBytes,   // full validated ContentSet JSON, a few KB
  seed, actions[],                             // the committed event log
  state }                                      // canonical serialized state after the last action
```

`Room` = code, envelope, two seat tokens, created/last-active timestamps, event
rows (§6). The server appends the action and writes the updated `state` in **one
SQLite transaction, before broadcasting** — NFR-6's guarantee. Content bytes are
embedded at game creation, so a later content release can never change a running
game and `contentHash` can never dangle.

**Rehydration rule (server restart or deploy):**

1. Stored `engineVersion` equals the running engine's → replay `actions` against
   `contentBytes` and assert the result hash-matches the stored `state` (a live
   determinism check, NFR-4 in production); on mismatch, prefer the stored `state`
   and log the discrepancy loudly.
2. Versions differ → do **not** replay old actions through new semantics. Zod-parse
   the stored `state`; if it parses, resume from it (the log is retained but marked
   pre-upgrade). If it does not parse, mark the room **unresumable**, tell the
   players plainly in-app, and emit the `unresumable` event. Never silently
   continue a game under changed rules.

**Deploy guard:** the deploy script refuses (absent `--force`) while any
non-terminal room has had an action in the last 48 hours. For a household game,
"deploy when nobody is mid-game" is the primary upgrade policy; the rehydration
rule is the backstop, and one manual upgrade drill (Phase 4) proves the backstop
works. Growth is bounded: a game is ~120 actions plus a few KB of content; rooms
expire and are deleted after 30 days.

### Trust boundaries and threat model

The server is the authority: clients submit actions with a sequence number; the
server rejects illegal actions (engine says so) and stale sequence numbers
(idempotent retries are safe). Hidden information never leaves the server except in
the owning player's snapshot — hand privacy is structural, not cosmetic.

Threat model beyond that: **not material.** No accounts, no PII, no payments, two
known users. Controls anyway: 128-bit random room codes, TLS via Apache/Certbot, a cap on
concurrent rooms and creation rate, room expiry. Accepted residual risk: DoS against
a hobby box (recovery: restart; committed state survives per NFR-6).

### Dependencies and failure domains

External runtime dependencies: none (no third-party APIs, no CDN assets — fonts and
art self-hosted). Failure handling: WebSocket drop → client auto-reconnects with
backoff and reclaims its seat by token (FR-11); server crash → systemd restarts,
rooms rehydrate per the rule above; deploy with active rooms → blocked by the
guard, or recovered via snapshot; SQLite file loss → restore the latest verified
nightly backup (worst case: lose games since last backup — accepted); hot-seat tab
eviction or refresh → resume from localStorage. Fails closed: if the server can't
validate, the action is rejected, never guessed.

### Concurrency and time

Turn-based with a single active player; the server serializes actions per room, so
there are no write races by construction. No wall-clock anywhere in rules (no turn
timers in v1). Timezones: irrelevant. Hot-seat and networked games share the
envelope format, so a hot-seat game could in principle be promoted to a networked
one later (a property of the design, not a requirement).

### Paths most likely to hurt

Not performance (the whole game state is a few KB; NFR-2 is generous) but
**rulebook-edge-case correctness**: phrase-boundary interactions, stumble-turn
semantics (ruled 2026-07-18: stumble replaces only the Dance step — to be recorded
in `docs/rules/decisions.md`), song_010/014 partner-history tracking,
variety-bonus position accounting. These are exactly what the Phase 2 test suite is
aimed at — and what the Phase 0 couch gate flushes out cheaply first.

## 5. Delivery phases

Ordering rationale: the biggest risk to this project is not technical — it is that
the game, as specified, isn't fun enough to survive contact with a real Tuesday
evening, or that the rulebook has holes that surface as table arguments. The
adversarial review correctly observed that the original plan deferred the first
human playtest until after 17–28 evenings of build work. The card list already
defines physical-prototype copy counts, so Phase 0 now buys that validation for one
or two evenings of card-making — before the engine exists. The second structural
risk — future coding sessions following the repository's stale, self-described
authoritative documents — is retired in the same phase.

### Phase 0 — Repository authority and the couch gate (2–4 evenings, high confidence)

Two halves, both cheap, each retiring a top risk.

**(a) Authority cleanup — done 2026-07-18 except the commit.** Completed in the
repo-cleanup session: `README.md` rewritten to the real project and paths; the
architecture rules from `9-project-context.md` folded into `CLAUDE.md` (the file
agents actually read) and the stale root file archived; `docs/clave-tech-stack.md`
headed with a historical/superseded banner neutralizing its §13 agent directives;
the unfilled pre-production templates moved to `docs/archive/templates/` and
`game-rules-draft.md` to `docs/archive/`; reference sweep confirmed no remaining
unqualified Rust/native/Android-first instruction. **Remaining:** commit
`docs/plans/` and the cleanup to git.

**(b) The couch gate.** Assemble the physical prototype straight from
`docs/cards/v1-card-list.md` (its copy counts exist for exactly this purpose):
index cards or printed sheets, Connection/Style/money on paper or dice. Play **at
least two full 16-count games with Mel**, with the Llorarás recording playing on a
speaker, ambient (D7). Record for each session: total duration, rules disputes and
their resolutions, tuning gripes, and whether both players want another game.
Append every ruling to `docs/rules/decisions.md` (including the 2026-07-18 stumble
ruling).

**Gate (all must hold):** both sessions completed under the rulebook as written
plus rulings; every dispute was resolvable by a ruling, not a redesign; both
players want to play again; the ambient-music experience worked (the song deck read
as the arc of the song). Durations are recorded to calibrate the digital pacing
target, not as a hard pass/fail — paper bookkeeping inflates them and the app
automates it away. **Failing this gate stops the project at the rules layer — the
cheapest possible point — for redesign, and blocks Phases 1–6.**

### Phase 1 — Scaffold and content (1–2 evenings, high confidence)

Scope: npm-workspaces monorepo (`engine`, `content`, `client`, `server`), TS strict,
Vitest, ESLint/Prettier, CI running tests + the bundle-size check; pin tool
versions; author `cards.json` and `song-lloraras.json` from
`docs/cards/v1-card-list.md` (amended with any Phase 0 tuning) with zod validation
and the doc-consistency count check; canonical-serialization helper and SHA-256
content hashing. **Gate:** `npm test` green including content-vs-doc count
assertions. Dependency: Phase 0 gate passed.

### Phase 2 — The engine, complete against the rulebook (8–14 evenings, medium confidence)

Scope: FR-1 through FR-8 and FR-13 as pure engine logic; NFR-4; `ENGINE_VERSION`
and the envelope type (used by both hot-seat and server). Test suite organized by
rulebook section (`setup.test.ts` ↔ §4, `dancing.test.ts` ↔ §6, …); property tests
with fast-check (every action from `legalActions` applies cleanly; no illegal
state reachable — Connection stays 0–10, hand ≤ 4 at turn end, Lead-first
invariant; replay round-trips); golden-replay corpus of ≥ 5 full games including a
Connection-0 loss, a stumble-heavy game, and a max-lessons game — each fixture
carrying its content bytes and engine version. A tiny CLI runner (`npm run play`)
makes the engine playable in-terminal. Every ambiguity discovered is resolved and
appended to `docs/rules/decisions.md` (and the rulebook amended) — that output is a
deliverable, not a side effect. **Gate:** all rulebook sections have named passing
tests; determinism corpus passes; ambiguity list written back to docs. Parallelism:
client screen skeletons (Phase 3) may start against snapshot fixtures once
`PlayerSnapshot` stabilizes mid-phase.

### Phase 3 — Hot-seat client: the game reaches the couch, digitally (8–12 evenings, medium confidence)

Scope: FR-9, FR-12, the UI surface of FR-1–FR-8 and FR-13, and the hot-seat half of
FR-11: the envelope persists to localStorage after every committed action, and the
Home screen offers resume — Android Chrome evicts background tabs aggressively, and
switching to a music app mid-game is the documented usage pattern, so this is not
optional polish. Engine runs in-browser; pass-the-device screen guards hand
privacy; phone-portrait layout first, laptop layout second. Playwright drives one
full scripted game plus a mid-game reload that must resume. **Gate:** a complete
Llorarás game played pass-and-play on one Android phone and on a MacBook; a
mid-game browser kill/reload resumes correctly on the phone; Playwright full-game
and resume specs green; at least one digital playtest with Mel logged (the couple's
second playtest overall — Phase 0 was the first).

### Phase 4 — Server and two-device play (6–10 evenings, medium confidence)

Scope: FR-10, the networked half of FR-11, FR-7 across devices; NFR-2 plumbing,
NFR-3, NFR-6. Rooms, seat tokens, per-role snapshot broadcast, reconnect,
transactional append-before-broadcast into SQLite, rehydration per the §4 rule,
the deploy guard, and the §6 game events. Playwright two-browser-context E2E
playing a full game including a mid-game reload of one context. **Gate:** full game
on two physical devices on home Wi-Fi (server on the Mac is fine here) with (1) a
deliberate mid-game refresh, (2) a deliberate `kill -9` of the server, and (3) a
simulated upgrade drill — bump `ENGINE_VERSION`, restart, and confirm the active
room resumes from its snapshot — all recovered losslessly.

### Phase 5 — Deploy, operations, and launch (4–6 evenings, high confidence)

Scope: FR-14, NFR-1, NFR-5; point `clave.dance` DNS at the stephens.page server,
Apache/Certbot + systemd, `playclave.com` → 301 redirect after its DNS cutover
(per D8); PWA manifest + icons (a
service worker only if the household's Chrome requires one for install — verify at
implementation; if added, it reuses the version handshake so a cached client can't
speak a stale protocol); nightly backup via `VACUUM INTO` + `PRAGMA
integrity_check` + atomic rotation, 14-day retention (per D5); `PRAGMA
user_version` schema versioning with forward-only migrations and documented
restore-based rollback; the SM-1/SM-2 queries written and documented.

**Gate = the launch checklist, all items must hold (it mirrors the traceability
matrix — no requirement is verified anywhere but here or CI):**

1. CI green: engine suite, property tests, determinism corpus, content checks,
   bundle-size check (NFR-5).
2. Deployed smoke matrix passes on **all three** device classes: Android Chrome
   (portrait phone), macOS Safari (MacBook), Windows Edge or Chrome (laptop)
   (NFR-1).
3. A complete two-device game over `https://clave.dance` (phone + MacBook) (FR-10,
   FR-14).
4. NFR-2 measured: scripted full game (≥ 100 actions, post-warm-up) through the
   deployed path; p50/p95/max recorded; **p95 < 500 ms**.
5. NFR-3 drill on the deployed instance: reconnect restores state in < 5 s.
6. NFR-6 drill on the deployed instance: `kill -9` mid-game, zero committed-action
   loss.
7. Upgrade drill on the deployed instance: `ENGINE_VERSION` bump + restart resumes
   an active room from its snapshot (FR-11).
8. Restore drill: latest nightly backup restores into a fresh path,
   `integrity_check` passes, and every room in it rehydrates (D5).
9. SM-1/SM-2 queries run against the drill data and return correct counts (§6
   Observability).
10. No known bug that blocks finishing a game.

Rollout/migration: greenfield with no users, so every step is reversible (git
revert + redeploy; database rollback = restore latest verified backup); no
irreversible steps exist in this plan.

### Phase 6 — Post-v1 menu (unscheduled, pick by appetite after the §6 review)

No-lessons variant (§11 — decks already defined); a second song deck (data-only,
per D6); original soundtrack + in-app audio; AI partner for solo practice; and —
only if its gate fires (D2) — the Rust core port validated against the
golden-replay corpus, followed by the native clients from
`docs/clave-tech-stack.md`.

**Estimate summary:** 29–48 evenings total; at 3–4 evenings/week, roughly 8–14
weeks to v1 — of which the game itself is playable (on paper) in week one and
playable digitally (hot-seat) around the halfway mark. Assumes Claude Code does the
heavy lifting, the Phase 0 gate passes without redesign, and rules ambiguities are
resolved by ruling (cheap) rather than redesign (expensive). Upper bounds are
low-confidence in Phases 2–3 if playtests force rules changes — mitigated by the
couch gate happening first and by tuning numbers living in content JSON.

## 6. Validation and operations

**Test levels.** Engine unit tests (per rulebook section, the primary safety net);
property tests (action legality, invariants, replay determinism); content tests
(schema + doc-count consistency); E2E via Playwright (hot-seat full game + reload
resume; two-context online game with reload); operational drills (server kill,
upgrade, backup restore — Phases 4–5); the deployed latency measurement (NFR-2);
the manual smoke matrix on all three device classes (Phase 5); and the human
playtests — physical (Phase 0) and digital (Phase 3 onward), logged.

**Traceability.**

| Req | Phase | Verified by |
| --- | --- | --- |
| FR-1 | 2 | `engine/tests/setup.test.ts` |
| FR-2 | 2 | `engine/tests/turn-loop.test.ts` |
| FR-3 | 2 | `engine/tests/dancing.test.ts` + property suite |
| FR-4 | 2 | `engine/tests/song-bonuses.test.ts` (one case per song card) |
| FR-5 | 2 | `engine/tests/phrase-scoring.test.ts` |
| FR-6 | 2 | `engine/tests/lessons.test.ts` |
| FR-7 | 2, 4 | `engine/tests/visibility.test.ts` (snapshot filtering); online E2E |
| FR-8 | 2 | `engine/tests/endgame.test.ts` |
| FR-9 | 3 | Playwright `hotseat.spec.ts` + Phase 3 gate playtest |
| FR-10 | 4 | Playwright `online.spec.ts`; launch item 3 |
| FR-11 | 3, 4, 5 | `hotseat.spec.ts` reload-resume; `online.spec.ts` reload step; Phase 4 kill/upgrade drills; launch items 5–7 |
| FR-12 | 3 | `hotseat.spec.ts` assertions + playtest checklist |
| FR-13 | 2, 3 | `engine/tests/undo.test.ts`; UI path in `hotseat.spec.ts` |
| FR-14 | 5 | Launch items 2–3 (deployed URL, redirect, PWA manifest) |
| NFR-1 | 5 | Launch item 2 (three-device smoke matrix) |
| NFR-2 | 5 | Launch item 4 (≥100-action measured p50/p95/max) |
| NFR-3 | 4, 5 | Timed reconnect drill; launch item 5 |
| NFR-4 | 2, 4 | Golden-replay corpus in CI; per-room rehydration hash check |
| NFR-5 | 1, 5 | CI bundle-size check; launch item 1 |
| NFR-6 | 4, 5 | Kill-server drill; launch item 6 |

**Observability and the game-event model.** Structured server logs (room
lifecycle, rejected actions, reconnects); `/healthz`. Durable game events, written
to SQLite alongside the rooms:

- `game_started` — emitted once, when both seats are claimed and the first action
  commits (SM-2's denominator).
- Terminal events, at most one per game: `completed` (song finished),
  `lost` (Connection 0), `unresumable` (version-upgrade casualty, from §4),
  `abandoned` (assigned by a sweep when a started game has had no action for
  72 hours).
- Hot-seat games POST a fire-and-forget completion beacon carrying the same shape,
  flagged `mode: hotseat`, so SM-1 counts couch games too (best-effort; a beacon
  lost to a network blip undercounts SM-1 slightly, accepted).
- A `test` flag on rooms created by drills and E2E runs, excluded from SM queries.

The SM-1/SM-2 SQL queries are written and committed in Phase 5 (launch item 9), not
improvised at review time. No alerting — the pager is Mel saying the game is down.
This is intentionally thin.

**Post-launch review.** Four weeks after launch, read SM-1/SM-2/SM-3 against
targets; Jacob decides: iterate (Phase 6 items), fix friction, or stop. Ownership
and ops: Jacob; nightly verified backups per D5; upgrades are `git pull` + deploy
script (with its active-room guard) + service restart; rollback is restore from the
latest verified backup.

## 7. Risks and pre-mortem

1. **"We built platform, not game."** Relapse into the five-platform/Rust
   architecture before the game is proven fun. *Mitigation:* D2's explicit gate;
   Phase 0(a) removes every stale claim of authority, not just one banner. *Early
   warning:* any FFI, binding, or second-language work appearing in `tasks/todo.md`
   before Phase 5 is done.
2. **"It wasn't fun."** Thirty minutes of rules administration kills the evening.
   *Mitigation:* the Phase 0 couch gate tests the actual game with the actual
   partner and the actual music for the cost of card-making, before any engine
   investment; tuning lives in JSON; FR-12 aids reduce cognitive load in the
   digital version. *Early warning:* the Phase 0 gate itself — that is what it is
   for. If it fails, the project stops at the rules layer, not after 20 evenings of
   TypeScript.
3. **"A deploy ate our game."** A balance or engine release lands mid-game and the
   room can't resume. *Mitigation:* the resume envelope (content bytes travel with
   the game; snapshots survive version bumps), the deploy guard, and the Phase 4/5
   upgrade drills. *Early warning:* any `unresumable` event in the logs.
4. **"The backup was a lie."** The first incident that needs a restore finds a
   torn copy. *Mitigation:* `VACUUM INTO` + `integrity_check` + rotation (D5) and a
   restore drill in the launch checklist, so the recovery path has been executed at
   least once before it is ever needed.
5. **"The evenings stopped."** Motivation stall mid-Phase-2 with nothing visible.
   *Mitigation:* Phase 0 delivers the actual pleasure (playing Clave with Mel) in
   week one; the CLI runner keeps the engine tangible; phases each end in something
   usable; `tasks/todo.md` keeps re-entry cost low after a gap.
6. **"The app and the rulebook disagree."** Table disputes because the engine
   silently diverged from `game-rules.md`. *Mitigation:* tests named by rulebook
   section; every ambiguity resolution written back to `docs/rules/decisions.md`
   and the rulebook in the same commit; the production rehydration hash check
   (NFR-4) catches determinism drift in the field.

Internal-consistency check: this plan supersedes `docs/clave-tech-stack.md` (scope)
and the concept brief's platform line by design — handled by the precedence note in
§1 and the Phase 0(a) cleanup, not left as silent drift.

## 8. Open questions and resolution log

No open questions remain. Resolution log:

| ID | Question | Resolution |
| --- | --- | --- |
| OQ-1 | Is the Linux server internet-reachable with a domain and TLS frontend? | **Resolved 2026-07-18; frontend corrected 2026-07-19.** Reachable (it serves stephens.page). Its existing Apache/Certbot frontend will proxy `clave.dance`; `playclave.com` redirects after its DNS cutover. DNS via Porkbun or Cloudflare DNS-only. Details in D8. |
| OQ-2 | Stumble-turn semantics: may the stumbling player still take a lesson and freshen up? | **Resolved 2026-07-18: yes.** A stumble replaces only turn step 2 (Dance); steps 1, 3, and 4 proceed. Rationale: §6's literal text ("no other *dance* cards"), avoiding a bad-hand death spiral, and the "recovery is a skill" pillar. Recorded in `docs/rules/decisions.md` at Phase 0(b), enforced by `engine/tests/dancing.test.ts` in Phase 2. |
| OQ-3 | Is speaker-played music acceptable for v1 evenings (no in-app audio)? | **Resolved 2026-07-18: yes**, confirmed by Jacob; playback model made explicit (ambient, unsynchronized — D7) after adversarial review; experience-validated at the Phase 0 couch gate. |
| — | Adversarial review 2026-07-18 | All six findings adjudicated (2 accepted, 4 partially accepted) plus two new findings accepted; this revision incorporates every accepted change. See `docs/plans/reviews/clave-plan-adjudication-2026-07-18.md`. |
