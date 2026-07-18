# Adjudication: adversarial review of the Clave v1 plan

*2026-07-18. Adjudicates
`docs/plans/reviews/clave-plan-adversarial-review-2026-07-18.md` (6 findings,
verdict "APPROVE WITH CHANGES") against `docs/plans/clave-plan.md`. Version check:
the review pinned the subject at SHA-256 `3e7a700c…83c98`; the file on disk at
adjudication time hashed identically — no version skew. The plan was untracked, so
the pre-adjudication original is preserved at
`docs/plans/reviews/clave-plan-original-2026-07-18.md`; the revised plan has been
applied to `docs/plans/clave-plan.md` (revision 2).*

## Intent and constraints

Objective: a digital v1 of Clave that Jacob and Mel can play at home on weeknight
evenings, on the devices already in the house, per `docs/rules/game-rules.md` (rules
of record) and `docs/cards/v1-card-list.md`. Non-negotiable constraints: one
platform for v1, chosen for fit (Jacob's 2026-07-18 direction, superseding the
five-platform tech-stack doc); browser delivery to bypass the documented
device-whitelisting install friction; rules/UI separation, data-driven content, and
deterministic seeded RNG (`9-project-context.md` — repository instruction);
hands-hidden co-op play per rulebook §9; rulebook wins over the tech-stack doc where
they conflict (e.g., no turn timers). Inferred (labeled as such): the ~30-minute
game length in the rulebook is a target, not a hard bound; "play at home" implies
home Wi-Fi is available, so offline P2P stays out of scope.

## Finding dispositions

| ID | Disposition | Severity | Evidence | Required action |
| --- | --- | --- | --- | --- |
| B1 | PARTIALLY ACCEPT | High | The original plan named fun as the top risk yet placed the first human playtest after Phases 0–2 (17–28 evenings by its own estimates) — confirmed from the original §5. `docs/cards/v1-card-list.md` explicitly defines copy counts "for the physical prototype," so a near-zero-cost physical playtest was always available. The music half is a clarity defect, not an open design fork: rulebook §5 defines a turn-based, untimed game of 16 thematic 8-counts; `0-dance.md` shows the recording is 3:42 ≈ 89 musical 8-counts; the concept brief's "the song is the match" is structural/thematic. No requirement asks for synchronized playback, so the "unresolved playback model" was D7 wording inviting misreading. | Accepted: new Phase 0(b) couch gate — assemble the physical deck from the card list, play ≥2 full games with Mel with the record playing ambient; pass criteria: sessions completed, disputes resolved by ruling not redesign, both want a rematch, ambient music works; failure blocks Phases 1–6. D7 rewritten to state ambient/unsynchronized playback explicitly; music sync added to Non-goals. Rejected: renaming the "8-count" unit (contradicts rulebook vocabulary, a governing requirement) and the synchronized-playback branch (no requirement behind it); the 20–40-minute window as hard pass/fail (paper bookkeeping inflates duration; recorded as calibration data instead). |
| B2 | PARTIALLY ACCEPT | High | Confirmed from the original plan: FR-11/NFR-6 promised lossless resume across restarts, §6 ops said upgrades are `git pull` + restart, and D6 encouraged frequent content tuning — but only `contentHash` (not content bytes), no engine/action versioning, and replay-only rehydration were specified. A tuning or reducer release with an active room would break resume exactly as described. | Accepted, right-sized: the persisted unit becomes the **resume envelope** (ENGINE_VERSION, contentHash, full content bytes, seed, action log, latest state snapshot) written transactionally before broadcast; rehydration rule: same version → replay + hash-verify; different version → resume from parsed snapshot, else declare the room unresumable explicitly; deploy guard refuses (absent `--force`) while a non-terminal room was active in the last 48 h; one manual upgrade drill in Phase 4 and again in the launch checklist. Rejected: version-adapter layers ("keep the old replay adapter") and an automated N→N+1→N CI acceptance matrix — scope beyond a two-user household service; the envelope + guard + drill fully resolve the defect (recorded in Non-goals). |
| B3 | PARTIALLY ACCEPT | Medium | SQLite's primary documentation (howtocorrupt.html; Backup API; `VACUUM INTO`), verified by the reviewer against sqlite.org on 2026-07-18 and consistent with the adjudicator's knowledge: copying a live database file can capture a torn state, and DB/journal/WAL must stay paired. The original plan's nightly `cp` was therefore false safety, and rollback/migrations were undeclared. Severity re-derived to medium, not high: the data is a household game's room logs and a metrics counter, and the plan already accepted losing in-flight games — the defect is an untrustworthy recovery path, not data of high value. | Accepted: backup = `VACUUM INTO` a temp file + `PRAGMA integrity_check` + atomic rotation, 14-day retention (D5); `PRAGMA user_version` schema versioning with forward-only migrations; documented rollback = restore latest verified backup; a restore drill in the launch checklist (item 8). Rejected: "explicit forward **and backward** compatibility for each migration" — bidirectional migration engineering for a one-process household service; restore-based rollback is the proportionate mechanism. |
| B4 | PARTIALLY ACCEPT | Medium | Confirmed directly: `9-project-context.md` still says "targeting Android… stack not yet decided" and links `docs/tech-stack-evaluation.md`/`docs/tdd.md` (paths that don't exist); `README.md` links a dozen moved paths; `docs/clave-tech-stack.md` self-labels "authoritative… for Claude Code agents" with §13 imperative Rust/native defaults. The original Phase 0 bannered only the tech-stack doc, leaving two other mis-directing agent-facing surfaces. | Accepted: Phase 0(a) — commit `docs/plans/` to git; rewrite `README.md` and `9-project-context.md` to v1 scope and real paths; convert the tech-stack doc's header to historical/post-v1 reference; one-time `rg`-assisted sweep for remaining unqualified Rust/native/Android-first instructions. Rejected: a standing CI Markdown link checker and a permanent `rg` CI gate — recurring infrastructure for a ~15-file docs set; the one-time sweep at the Phase 0 gate suffices. |
| B5 | ACCEPT | Medium | Confirmed from the original §6: launch criteria named only Android + MacBook while NFR-1 requires three device classes; NFR-2 (a p95 bound) was "verified" by a single timed Playwright assertion, which cannot establish a percentile; NFR-2 was absent from the launch list entirely. | Launch checklist rewritten to mirror the traceability matrix as the single authoritative gate (Phase 5, items 1–10): three-device deployed smoke matrix; NFR-2 measured over a full scripted game (≥100 actions, post-warm-up) with p50/p95/max recorded and p95 < 500 ms as pass/fail; NFR-3/NFR-6 drills, the upgrade drill, and the restore drill all enumerated with explicit pass evidence. (The suggestion to *generate* the checklist from the table was dropped as process overhead; the checklist now enumerates the same rows, which is the substance of the ask.) |
| B6 | ACCEPT | Low | Confirmed: the original observability section recorded only completed games; SM-2 (a completion *rate*) had no denominator and no abandonment rule, so it could not be computed at the four-week review. Adjudication also extends the fix: SM-1 counted from the server log alone would silently miss hot-seat games, which run entirely client-side. | Durable game-event model (§6): `game_started` when both seats are claimed and the first action commits; exactly one terminal event per game (`completed` / `lost` / `unresumable` / `abandoned` after 72 h without an action); a `test` flag excluding drill and E2E rooms; a fire-and-forget hot-seat completion beacon so SM-1 counts couch games; SM-1/SM-2 SQL committed in Phase 5 (launch item 9), not improvised at review time. |
| NEW1 | ACCEPT | Medium | Missed by the review's findings (its revised outline brushed against it but assigned no finding): FR-11 promised refresh-safe games, yet hot-seat (Phase 3) precedes the server and originally had no persistence at all. Android Chrome aggressively evicts background tabs, and the documented usage — switching to a music app mid-game on the same phone — makes eviction likely during the flagship first digital playtest. A 30-minute couch game lost to a tab discard is exactly the failure the plan claims to prevent. | FR-11 restated to cover both modes: hot-seat persists the same resume envelope to localStorage after every committed action, with resume offered on load; Playwright reload-resume spec and a mid-game browser-kill drill on a real phone added to the Phase 3 gate. |
| NEW2 | ACCEPT | Low | Missed by the review: a cached/installed PWA client can outlive a server deploy and speak a stale protocol; separately, whether Chrome's install prompt still requires a service worker varies by version and was not a claim worth asserting unverified. | Version handshake: the client sends engine/protocol version on join; mismatch → reload prompt (Phase 4). PWA manifest ships in Phase 5; a service worker is added only if the household's Chrome requires one for install (verified at implementation — no plan decision depends on it), and if added it reuses the same handshake. |

Preflight inventory: 6 Agent B findings; 6 rows above match, in review order,
followed by 2 NEW findings. No finding omitted.

## Missed findings

- **NEW1 (ACCEPT, medium):** no hot-seat persistence despite FR-11's promise and
  Android tab-eviction reality — see table row for evidence and action.
- **NEW2 (ACCEPT, low):** stale-client protocol skew for a cached/installed PWA,
  plus an unverified service-worker installability assumption — see table row.

Also folded into B6's action rather than raised separately: SM-1's original
measurement ("server completed-game log") would have missed hot-seat games
entirely; the hot-seat completion beacon closes it.

## Disagreements

- **B1 — the music half and the proposed remedy.** The reviewer treated
  "synchronized vs. ambient playback" as an unresolved design fork and proposed
  renaming the 8-count unit. The governing requirements settle it: rulebook §5
  defines a turn-based game with no real-time element and deliberately names its
  unit the "8-count"; the concept brief's "the song is the match" describes
  structure and mood, not clock-synchronization; `0-dance.md`'s 89-8-count figure
  proves a 16-turn, ~30-minute game was never a literal mapping of the 3:42
  recording. What stands: the late placement of the first playtest (accepted, fixed
  with the Phase 0 couch gate) and D7's vague wording (fixed — ambient playback is
  now explicit, and sync is a named non-goal). What fails: renaming rulebook
  vocabulary, building a synchronized-playback option, and the hard 20–40-minute
  pass/fail window for *paper* sessions.
- **B2 — the remedy's upper half.** The defect is real and fully accepted. The
  remedy is right-sized down: persisting content bytes in the envelope makes the
  "content registry retained for room lifetime" trivial (a few KB per room, no
  registry needed); the snapshot-fallback rehydration rule replaces version
  adapters; the deploy guard plus one manual upgrade drill replaces an automated
  N→N+1→N acceptance pipeline. For two users on one box, adapters and a
  cross-version CI matrix are architecture without a requirement.
- **B3 — bidirectional migrations.** Backup mechanics accepted wholesale (the
  SQLite-documentation evidence is decisive). Requiring every schema migration to
  be forward- *and backward*-compatible is enterprise practice for fleets with
  staged rollouts; here rollback is "restore the latest verified backup," which the
  launch checklist now proves works.
- **B4 — standing CI gates.** The cleanup is accepted and expanded (README and
  `9-project-context.md`, not just the tech-stack banner). A permanent Markdown
  link checker and `rg` CI gate for a docs set this size is recurring cost for a
  one-time problem; the sweep happens once at the Phase 0 gate.
- **B5 — accepted**, with one procedural flourish dropped: the launch checklist
  *mirrors* the traceability matrix rather than being generated from it.

## Readiness

**READY.** Every accepted and partially accepted finding (B1–B6, NEW1, NEW2) is
incorporated in revision 2 of the plan; no disposition is DEFER, so no unresolved
critical/high uncertainty remains at the adjudication layer. Note the distinction:
the revised plan's own Phase 0 couch gate can still stop the project if the game
isn't fun — that is the plan working as designed (in-plan sequencing with a named
gate and blocked phases), not adjudication uncertainty. Implementation may begin
with Phase 0; Phases 1–6 are blocked until its gate passes, as the plan itself now
states.

## Revised plan

The complete replacement plan is applied at `docs/plans/clave-plan.md` (revision 2,
2026-07-18). It is reproduced here in full as the point-in-time record of this
adjudication; if the two ever differ, the live file is current and this copy is
historical.

---

# Plan: Clave — A Partner Dance Game (Salsa), v1

*Revision 2, 2026-07-18 — adjudicated after adversarial review
(`docs/plans/reviews/clave-plan-adversarial-review-2026-07-18.md`; adjudication:
`docs/plans/reviews/clave-plan-adjudication-2026-07-18.md`; the pre-adjudication
original is preserved as `docs/plans/reviews/clave-plan-original-2026-07-18.md`).
Sources: `docs/rules/game-rules.md` (rules of record), `docs/cards/v1-card-list.md`,
`docs/rules/decisions.md`, `docs/living-documents/1-concept-brief.md`,
`docs/living-documents/0-dance.md`, `docs/clave-tech-stack.md`,
`9-project-context.md`, and Jacob's planning direction of 2026-07-18.*

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
device-whitelisting constraint, the headless-logic and data-driven-content rules in
`9-project-context.md` — this plan keeps them. Phase 0 updates the repository's
root documents so no other file still claims authority it no longer has.

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
source of truth, testability, and `9-project-context.md`'s standing rule that logic
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
lookups). This honors `9-project-context.md`'s data-driven rule and makes tuning and
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
known users. Controls anyway: 128-bit random room codes, TLS via Caddy, a cap on
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

**(a) Authority cleanup.** Commit `docs/plans/` (this plan and its reviews) to git.
Rewrite `README.md` and `9-project-context.md` to describe the v1 web/TypeScript
scope and point at real paths (`docs/rules/game-rules.md`,
`docs/cards/v1-card-list.md`, this plan) — both currently say "targeting Android /
stack undecided" and link a dozen documents that no longer exist at those paths.
Convert the header of `docs/clave-tech-stack.md` to "historical / post-v1
reference — superseded for v1 by `docs/plans/clave-plan.md`" so its §13 agent
directives can't fork a future session's architecture. One-time `rg`-assisted sweep
confirming no document still unqualifiedly instructs Rust/native/Android-first v1
work.

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
Caddy + systemd, `playclave.com` → 301 redirect (per D8); PWA manifest + icons (a
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
| OQ-1 | Is the Linux server internet-reachable with a domain for Caddy auto-TLS? | **Resolved 2026-07-18.** Reachable (it serves stephens.page). `clave.dance` primary, `playclave.com` redirects; DNS via Porkbun or Cloudflare DNS-only. Details in D8. |
| OQ-2 | Stumble-turn semantics: may the stumbling player still take a lesson and freshen up? | **Resolved 2026-07-18: yes.** A stumble replaces only turn step 2 (Dance); steps 1, 3, and 4 proceed. Rationale: §6's literal text ("no other *dance* cards"), avoiding a bad-hand death spiral, and the "recovery is a skill" pillar. Recorded in `docs/rules/decisions.md` at Phase 0(b), enforced by `engine/tests/dancing.test.ts` in Phase 2. |
| OQ-3 | Is speaker-played music acceptable for v1 evenings (no in-app audio)? | **Resolved 2026-07-18: yes**, confirmed by Jacob; playback model made explicit (ambient, unsynchronized — D7) after adversarial review; experience-validated at the Phase 0 couch gate. |
| — | Adversarial review 2026-07-18 | All six findings adjudicated (2 accepted, 4 partially accepted) plus two new findings accepted; this revision incorporates every accepted change. See `docs/plans/reviews/clave-plan-adjudication-2026-07-18.md`. |

---

*End of embedded revised plan.*

## Verification matrix

| Requirement / finding / gate | Revised-plan step | Verified by |
| --- | --- | --- |
| FR-1 setup | Phase 2 | `engine/tests/setup.test.ts` green in CI |
| FR-2 turn loop | Phase 2 | `engine/tests/turn-loop.test.ts` green in CI |
| FR-3 dance rules (incl. stumble ruling) | Phase 2 | `engine/tests/dancing.test.ts` + fast-check property suite green |
| FR-4 song bonuses | Phase 2 | `engine/tests/song-bonuses.test.ts`, one named case per song card |
| FR-5 phrase scoring | Phase 2 | `engine/tests/phrase-scoring.test.ts` green |
| FR-6 lessons | Phase 2 | `engine/tests/lessons.test.ts` green |
| FR-7 signaling / hidden hands | Phases 2, 4 | `engine/tests/visibility.test.ts` snapshot filtering; online E2E asserts partner hand never in payload |
| FR-8 end of dance | Phase 2 | `engine/tests/endgame.test.ts` incl. Connection-0 golden replay |
| FR-9 hot-seat | Phase 3 | Playwright `hotseat.spec.ts` full game; Phase 3 gate playtest on phone + MacBook |
| FR-10 two-device play | Phase 4 | Playwright `online.spec.ts` full game; launch item 3 on deployed URL |
| FR-11 resume (both modes, cross-deploy) | Phases 3, 4, 5 | `hotseat.spec.ts` reload-resume; `online.spec.ts` reload; Phase 4 kill + upgrade drills; launch items 5–7 pass |
| FR-12 playability aids | Phase 3 | `hotseat.spec.ts` assertions + Phase 3 playtest checklist |
| FR-13 undo | Phases 2, 3 | `engine/tests/undo.test.ts`; undo path exercised in `hotseat.spec.ts` |
| FR-14 deployed access | Phase 5 | Launch items 2–3: clave.dance reachable on 3 device classes, playclave.com 301, manifest present |
| NFR-1 device coverage | Phase 5 | Launch item 2: smoke matrix pass on Android Chrome, macOS Safari, Windows Edge/Chrome |
| NFR-2 latency p95 | Phase 5 | Launch item 4: ≥100-action deployed run, recorded p50/p95/max, p95 < 500 ms |
| NFR-3 resume < 5 s | Phases 4, 5 | Timed reconnect drill; launch item 5 |
| NFR-4 determinism | Phases 2, 4 | Golden-replay corpus (100% byte-identical) in CI; per-room rehydration hash check in server code |
| NFR-5 bundle < 500 KB gz | Phases 1, 5 | CI size check fails the build over threshold; launch item 1 |
| NFR-6 durability | Phases 4, 5 | Transactional append-before-broadcast + `kill -9` drill, zero committed-action loss; launch item 6 |
| B1 (couch gate + ambient audio) | Phase 0(b); D7; Non-goals | Gate: ≥2 completed physical sessions, disputes ruled not redesigned, mutual rematch intent, ambient music validated; failure blocks Phases 1–6 |
| B2 (resume envelope + deploy safety) | §4 envelope + rehydration rule + deploy guard; Phases 4–5 | Phase 4 upgrade drill (ENGINE_VERSION bump → snapshot resume); launch item 7; deploy script refuses active rooms without `--force` |
| B3 (backup integrity + rollback) | D5; Phase 5 | Nightly `VACUUM INTO` + `integrity_check` + rotation; launch item 8 restore drill: fresh-path restore, integrity pass, all rooms rehydrate |
| B4 (source-of-truth cleanup) | Phase 0(a) | Gate: plan committed; README + 9-project-context rewritten to real paths; tech-stack doc header converted; `rg` sweep finds no unqualified Rust/native v1 instruction |
| B5 (launch gate completeness) | Phase 5 launch checklist | Checklist items 1–10 mirror the traceability matrix; three device classes and NFR-2/3/6 drills are explicit all-must-hold items |
| B6 (SM measurability) | §6 game-event model; Phase 5 | Launch item 9: SM-1/SM-2 SQL committed and returning correct counts against drill data (started/terminal/abandoned/test-flag semantics exercised) |
| NEW1 (hot-seat persistence) | FR-11; Phase 3 | `hotseat.spec.ts` mid-game reload resumes; Phase 3 gate includes browser-kill drill on a physical phone |
| NEW2 (stale-client handshake) | Phase 4 handshake; Phase 5 PWA note | Version mismatch on join produces reload prompt (asserted in `online.spec.ts` with a forced version skew); SW-requirement verified at implementation before adding one |
