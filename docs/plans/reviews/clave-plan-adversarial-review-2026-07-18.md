APPROVE WITH CHANGES. The single responsive web app and headless TypeScript engine are a sound v1 direction, but the plan is not implementation-ready until it validates the core musical/gameplay premise before the full engine investment and makes replay recovery complete across content and code deployments.

## Review scope and evidence

- **Subject:** [`docs/plans/clave-plan.md`](../../../docs/plans/clave-plan.md), reviewed 2026-07-18. The subject was untracked, so it is pinned by SHA-256 `3e7a700cce5216e2d60df93ec3984da12d575ec0562b635340e7acecec383c98`; repository context was commit `2707f9f92a6d614fd9e4f9e2c57f9df28400d742`. Pre-review dirty state: tracked `tasks/todo.md` modified and the subject untracked.
- **Governing requirements:** [`docs/rules/game-rules.md`](../../../docs/rules/game-rules.md), [`docs/cards/v1-card-list.md`](../../../docs/cards/v1-card-list.md), [`docs/rules/decisions.md`](../../../docs/rules/decisions.md), [`docs/living-documents/1-concept-brief.md`](../../../docs/living-documents/1-concept-brief.md), [`docs/living-documents/0-dance.md`](../../../docs/living-documents/0-dance.md), [`9-project-context.md`](../../../9-project-context.md), and the precedence decisions stated in the subject.
- **Evidence examined:** The complete subject and governing requirements; `CLAUDE.md`, `README.md`, `docs/clave-tech-stack.md`, `docs/living-documents/4-card-schema.md`, the existing UX/TDD/QA/analytics/launch templates, and `tasks/todo.md`. The repository contains no application source, package manifest, tests, database schema, deployment configuration, or running-system evidence yet, so implementation claims could only be assessed as proposed design.
- **External facts verified:** SQLite's official documentation, accessed 2026-07-18: a filesystem copy of a live database can be inconsistent if it overlaps a transaction, while `VACUUM INTO` and the backup API are supported consistent-copy mechanisms; database and hot journal/WAL files must remain paired for recovery ([How To Corrupt An SQLite Database File](https://www.sqlite.org/howtocorrupt.html), [SQLite Backup API](https://www.sqlite.org/backup.html)).
- **Excluded scope and limitations:** The claimed server reachability, domain ownership/DNS state, device-whitelisting constraint, and actual household devices were not independently accessible and are treated as user-supplied facts. No licensing opinion was made. Browser and library version compatibility was not checked because Phase 0 explicitly pins versions and none of the findings depends on a particular current version.

## Reconstructed plan

- **Outcome and users:** Jacob and Mel can complete the 16-turn Llorarás game at home on one device or two browser-capable devices, with private hands, enforced rules, scoring, resume, and a stable HTTPS URL.
- **Architecture and trust:** A deterministic, data-driven TypeScript reducer is shared by a React hot-seat client and a server-authoritative Node/WebSocket service. SQLite stores per-room action logs; role snapshots are the hidden-information boundary.
- **Failure domains and operations:** systemd restarts the application, event replay rehydrates rooms, Caddy terminates TLS, and a nightly SQLite file copy is the proposed backup. Rooms expire after 30 days.
- **Validation and rollout:** Content and engine precede the first hot-seat human playtest; networking, deployment, cross-device smoke tests, and a four-week value review follow. Native clients, offline P2P, in-app audio, and additional songs remain deferred.

## Findings

### 1. The highest-risk gameplay and music premise is tested only after 17–28 evenings of build work

- **Severity:** High
- **Location:** Delivery ordering and Phases 0–2 at [`clave-plan.md:290`](../../../docs/plans/clave-plan.md:290), [`clave-plan.md:297`](../../../docs/plans/clave-plan.md:297), and [`clave-plan.md:307`](../../../docs/plans/clave-plan.md:307); audio decision at [`clave-plan.md:201`](../../../docs/plans/clave-plan.md:201); source premise at [`game-rules.md:5`](../../../docs/rules/game-rules.md:5), [`game-rules.md:29`](../../../docs/rules/game-rules.md:29), and [`0-dance.md:5`](../../../docs/living-documents/0-dance.md:5).
- **Problem:** The plan correctly names fun and rules administration as its largest risk, yet the first real playtest with Mel is the Phase 2 deliverable, after 1–2 evenings of scaffolding, 8–14 evenings of full-engine work, and 8–12 evenings of client work. More importantly, the experience model is unresolved: the rulebook calls a roughly 30-minute game sixteen music 8-counts, while the dance source describes the 3:42 recording as 89 8-counts; D7 says the recording plays on a speaker and the deck sequences its structure, but does not say whether playback is synchronized, looped, restarted, or merely ambient.
- **Failure scenario:** The complete reducer and phone UI are built, then the first couch session shows that player decisions cannot track the recording, the song finishes while early turns are still being resolved, or the 16-card abstraction does not feel connected to the musical arc. Fixing that can change turn units, song-card timing, bonus resolution, and UI pacing—precisely the expensive redesign the phase order is supposed to avoid.
- **Recommendation:** Add a pre-Phase-1 gameplay gate using the physical/card-list data or the smallest disposable CLI. Run two full 16-turn sessions with the actual recording and the intended pass-the-device behavior; record total game time, turn times, rules adjudications, and whether both players want another game. Before engine implementation, explicitly choose either (a) ambient/looped playback and rename the logical unit so it is not represented as a literal synchronized 8-count, or (b) synchronized playback with a tested timing/mapping rule. Do not pass the gate unless both sessions finish in the intended 20–40 minute window, no music-mapping question remains unresolved, and both players agree the song integration improves the experience.
- **Confidence:** High

### 2. A content hash alone cannot make event replay survive deployments

- **Severity:** High
- **Location:** Replay and recovery claims at [`clave-plan.md:153`](../../../docs/plans/clave-plan.md:153), [`clave-plan.md:169`](../../../docs/plans/clave-plan.md:169), [`clave-plan.md:223`](../../../docs/plans/clave-plan.md:223), and [`clave-plan.md:244`](../../../docs/plans/clave-plan.md:244); deployment and upgrade claims at [`clave-plan.md:341`](../../../docs/plans/clave-plan.md:341) and [`clave-plan.md:406`](../../../docs/plans/clave-plan.md:406).
- **Problem:** A game row contains `seed`, `contentHash`, and actions, but the plan does not persist the immutable content bytes addressed by that hash, retain a content registry for the 30-day room lifetime, or version the action schema and reducer semantics. The golden corpus validates the current engine and fixtures; it does not ensure that a new deployment can replay an old room. The claim that a game is just seed plus log is therefore incomplete.
- **Failure scenario:** A balance or rules update changes JSON or reducer behavior while an active room exists. `git pull` and service restart then either cannot resolve the old `contentHash`, parses an old action differently, or produces a different derived state. The room cannot resume despite FR-11/NFR-6, and reverting application code may also fail if the database/event schema has advanced.
- **Recommendation:** Before Phase 3, define a replay envelope containing `engineReplayVersion`, `actionSchemaVersion`, `contentHash`, and either the immutable validated `ContentSet` bytes or a guaranteed retained content bundle keyed by that hash. Define incompatible-version behavior: drain active rooms, run an explicit migration, or keep the old replay adapter—never silently use current content. Add an upgrade/rollback acceptance test that starts and commits a game on release N, deploys N+1 and restarts, resumes to an identical canonical state, then rolls back to N against the same database. Reject deployment if any retained room cannot be replayed exactly.
- **Confidence:** High

### 3. The proposed live SQLite copy is not a reliable backup or rollback mechanism

- **Severity:** Medium
- **Location:** Backup and recovery at [`clave-plan.md:261`](../../../docs/plans/clave-plan.md:261), Phase 4 reversibility at [`clave-plan.md:341`](../../../docs/plans/clave-plan.md:341), and operations at [`clave-plan.md:406`](../../../docs/plans/clave-plan.md:406).
- **Problem:** The plan specifies nightly `cp` of a database used by a live process and treats loss of in-flight games as the worst case. SQLite documents that a filesystem copy overlapping a transaction can contain mixed old/new pages and be corrupt, and that journal/WAL state must stay paired with the database. It provides the online backup API and `VACUUM INTO` for consistent live copies ([official backup/corruption guidance](https://www.sqlite.org/howtocorrupt.html)). The plan also declares every deployment reversible without defining schema migrations or a restore test.
- **Failure scenario:** Cron copies the main file during an action commit or without its current journal/WAL. A later disk failure reveals that the only backup is inconsistent. Alternatively, an application rollback encounters a schema written by the newer release and cannot start, turning `git revert` into downtime rather than recovery.
- **Recommendation:** Replace raw `cp` with SQLite's online backup API or `VACUUM INTO`, write to a temporary destination, verify the copied database with `PRAGMA integrity_check`, then atomically rotate it. Version the database schema and require explicit forward and backward compatibility for each migration. Phase 4 must include a restore drill into a fresh path followed by full room replay, plus the N→N+1→N deployment test from Finding 2.
- **Confidence:** High

### 4. Phase 0 does not fully resolve the repository's conflicting source-of-truth instructions

- **Severity:** Medium
- **Location:** Precedence and Phase 0 at [`clave-plan.md:20`](../../../docs/plans/clave-plan.md:20) and [`clave-plan.md:297`](../../../docs/plans/clave-plan.md:297); conflicting repository guidance at [`9-project-context.md:3`](../../../9-project-context.md:3), [`README.md:3`](../../../README.md:3), [`clave-tech-stack.md:1`](../../../docs/clave-tech-stack.md:1), and [`clave-tech-stack.md:588`](../../../docs/clave-tech-stack.md:588).
- **Problem:** Phase 0 adds a supersession banner only to the old tech-stack document. The root context still says Android and an undecided stack, its key-document paths do not exist, and the README also points to nonexistent old paths. The tech-stack document labels itself authoritative and contains direct implementation defaults for Rust/native clients. Because the plan explicitly relies on coding agents, leaving multiple unqualified instruction surfaces creates a predictable architecture fork even if one document has a banner.
- **Failure scenario:** A later session follows the root context or the tech-stack agent instructions, scaffolds Rust/content-pack/native structure, or edits a nonexistent/obsolete rules path. The mistake may survive several evenings before comparison with the untracked plan reveals it, producing avoidable deletion and rework.
- **Recommendation:** Make source-of-truth cleanup part of the Phase 0 gate: track this plan (or its adjudicated replacement), update `README.md` and `9-project-context.md` to the v1 web/TypeScript scope and real paths, and convert `docs/clave-tech-stack.md` to an explicitly historical/post-v1 reference whose first screen links back to the current plan. Add a CI link check for internal Markdown paths and an `rg` gate showing no remaining unqualified instruction to implement Rust/native v1.
- **Confidence:** High

### 5. The launch gate can pass without satisfying the stated device and latency requirements

- **Severity:** Medium
- **Location:** NFR-1/NFR-2 at [`clave-plan.md:89`](../../../docs/plans/clave-plan.md:89), Phase 4 at [`clave-plan.md:341`](../../../docs/plans/clave-plan.md:341), and validation/launch criteria at [`clave-plan.md:363`](../../../docs/plans/clave-plan.md:363) and [`clave-plan.md:401`](../../../docs/plans/clave-plan.md:401).
- **Problem:** NFR-1 and the Phase 4 scope require Android, macOS, and Windows, but the all-must-hold launch criteria name only Android and MacBook. NFR-2 is a p95 bound, yet its verifier is described as one timed Playwright assertion; a single observation cannot establish a percentile or exercise the deployed physical-device path. The launch criteria do not explicitly require NFR-2 at all.
- **Failure scenario:** CI and the two-device Android/Mac drill pass while the Windows layout has a blocking viewport/input bug or normal deployed actions exceed 500 ms at the tail. The plan still declares launch because its authoritative launch list is narrower than its requirements and traceability table.
- **Recommendation:** Make the traceability table generate or directly mirror the launch checklist. Require the deployed smoke matrix on all three named device classes. For NFR-2, instrument action IDs and measure at least 100 representative post-warm-up actions through the deployed path, reporting p50/p95/max from submission until both rendered snapshots are acknowledged; fail launch if p95 is 500 ms or more. Put the NFR-3 and NFR-6 drills in the same all-must-hold checklist with explicit pass evidence.
- **Confidence:** High

### 6. SM-2 cannot be computed from the proposed completed-game log

- **Severity:** Low
- **Location:** Success metrics at [`clave-plan.md:34`](../../../docs/plans/clave-plan.md:34) and observability at [`clave-plan.md:397`](../../../docs/plans/clave-plan.md:397).
- **Problem:** A completion rate needs a denominator and an abandonment rule. The proposed observability records completed games but does not define when a networked game becomes eligible, how duplicate/restarted rooms count, or when inactivity becomes abandonment.
- **Failure scenario:** At the four-week review, only completions are queryable, so SM-2 is either reported as 100%, guessed from room rows, or abandoned. The iterate/stop decision then lacks the signal the metric was meant to provide.
- **Recommendation:** Emit one durable `game_started` fact when both seats are claimed and the first committed turn begins; emit the terminal reason once; define abandonment as no terminal event after a fixed inactivity window (for example 24 hours), exclude test rooms, and document the exact numerator/denominator query before launch.
- **Confidence:** High

## Lenses without a material blocker

- **Feasibility, scale, performance, and cost:** React/TypeScript, a single Node process, WebSockets, and SQLite are proportionate to two household users. No evidence supports adding a hosted realtime vendor, Rust, or a larger database for v1.
- **Security and privacy:** With no accounts, PII, payments, or hostile-user requirement, capability-style room and seat tokens plus server-side legality checks are a reasonable v1 boundary. Exact token handling, resource caps, log redaction, and systemd least privilege should be implementation acceptance details, but the reviewed evidence does not establish a critical or high security defect.
- **Concurrency and time:** Serializing actions per room and keeping wall-clock time out of the reducer is sound. The remaining concurrency risk is chiefly upgrade/retry compatibility, covered by Finding 2.

## Pre-mortem: likely causes of failure after six months

1. The project spends several weeks perfecting reducer correctness and phone layout; the first real session reveals that a 30-minute turn-based game and a 3:42 recording have no coherent relationship, so redesign competes with depleted evening-project motivation and work stops.
2. A seemingly harmless card-balance deploy restarts the server while a room is active; the new process cannot reproduce the old content/reducer semantics, resume fails, and the couple returns to a physical or abandoned prototype.
3. Nightly jobs appear healthy for months, but the first disk or operator incident requires a restore; the copied SQLite file is inconsistent or incompatible with the rolled-back binary, so the documented recovery path fails at the only time it matters.
4. A future coding session follows the repository's still-authoritative Rust/Android instructions, introduces a parallel architecture, and turns a one-codebase v1 into a reconciliation exercise.
5. The launch checklist passes on Android and macOS, but Windows or tail latency is poor in ordinary home use; apparent launch success is followed by abandoned sessions and unreliable post-launch metrics.

## Final assessment

### 1. Verdict

APPROVE WITH CHANGES

### 2. Blocking issues

1. Validate and decide the musical/gameplay timing model before committing to the complete engine and client phases.
2. Define immutable content retention, replay/event versions, and upgrade/rollback behavior before implementing persistent network rooms.

The SQLite backup, repository source-of-truth cleanup, and executable launch gates must also be resolved before their affected phases, but they do not require changing the core web/TypeScript architecture.

### 3. Highest-value changes

1. Insert a two-session paper/disposable-CLI gameplay-and-music gate before Phase 1, with an explicit playback model and measurable pass/reject criteria.
2. Specify and test a version-complete replay envelope across N→N+1 deployment and rollback, retaining the exact content needed by every live room.
3. Replace live `cp` with a verified SQLite online backup/restore workflow and make all NFR/device checks part of one authoritative launch gate.

### 4. Revised plan outline

1. **Authority and prototype gate:** Track the governing plan, repair root documentation links and precedence, then run two no/low-code full-game sessions with the actual music. Record duration, turn pacing, adjudications, and rematch intent; decide synchronized versus ambient playback before proceeding.
2. **Content and engine contract:** Scaffold only after the prototype gate. Define canonical serialization, PRNG/shuffle behavior, action schema version, engine replay version, immutable content hashing/storage, and undo semantics before building the complete reducer. Keep rulebook-section, property, and golden-replay tests.
3. **Hot-seat value slice:** Build the phone-first pass-and-play client, clarify whether FR-11 applies to hot-seat refreshes, and either add local action-log persistence or explicitly scope resume to network rooms. Require two human playtests rather than waiting until the end of the phase for the first one.
4. **Versioned multiplayer and recovery:** Implement authoritative rooms with transactional append-before-broadcast, request/action identifiers, retained content bundles, and seat reclaim. Gate on crash injection and N→N+1→N replay/rollback tests, not a single restart drill.
5. **Safe deployment and operations:** Deploy under Caddy/systemd with explicit schema migration rules, SQLite online backup, integrity verification, restore drill, resource limits, and a rollback artifact tied to the database/replay version.
6. **Executable launch and learning loop:** Run the three-device deployed smoke matrix; collect at least 100 latency samples for the p95 bound; execute reconnect/crash/restore gates; and instrument started, completed, lost, and abandoned games so SM-1/SM-2 can be queried exactly at four weeks.
