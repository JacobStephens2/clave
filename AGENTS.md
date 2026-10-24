# Clave — A Partner Dance Game (Salsa)

A cooperative two-player digital card game in which a Lead and a Follow salsa
dance a song together. v1 is a single responsive web app (headless TypeScript
engine + hot-seat and two-device play). The governing build plan is
`docs/plans/clave-plan.md`; the rules of record are `docs/rules/game-rules.md`.

# Project workflow

## Task tracking
- Work from `tasks/todo.md`. Each line is a task in the form `- [ ] task description` (markdown checkbox list item).
- When a task is completed, move it to `tasks/done.md` (change `- [ ]` to `- [x]`) and remove it from `tasks/todo.md`.

# Architecture rules

- Game logic lives in the headless engine package, decoupled from rendering; UIs
  render from `PlayerSnapshot` only.
- All card and song content is data-driven (JSON validated by schemas) — never
  hardcode card behavior or balance numbers in engine or UI code.
- Deterministic, seedable RNG only; no wall-clock and no unseeded randomness in
  the engine.
- Card and content IDs follow `<type>_<###>`: `pos_`, `mov_`, `flo_`, `rec_`,
  `song_`, and `call_` (a call is a clause in `rules.call.options`, not a card).
- Rules ambiguities are resolved as rulings appended to `docs/rules/decisions.md`
  (with the rulebook amended in the same commit) — never silently decided in code.

# Key documents

- `docs/plans/clave-plan.md` — the adjudicated v1 build plan (scope, stack,
  phases). Supersedes `docs/clave-tech-stack.md`, which is historical/post-v1
  reference only — do not implement from it.
- `docs/rules/game-rules.md` — the rulebook.
- `docs/rules/decisions.md` — rules decisions and rulings.
- `docs/cards/v1-card-list.md` — the v1 card set and song deck.
- `docs/living-documents/1-concept-brief.md` — pitch, pillars, non-goals.
- `docs/living-documents/0-dance.md` — the Llorarás song/dance structure behind
  the v1 song deck.

# Agent skills

## Issue tracker

Issues live as GitHub issues in `JacobStephens2/clave`, managed with the `gh` CLI. See `docs/agents/issue-tracker.md`.

## Triage labels

The five canonical triage roles, using their default label strings. See `docs/agents/triage-labels.md`.

## Domain docs

Single-context: `CONTEXT.md` and `docs/adr/` at the repo root. See `docs/agents/domain.md`.
