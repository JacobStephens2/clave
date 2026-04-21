# Card Game Pre-Production Docs

Stack-agnostic templates for an Android card game. The engine/framework is intentionally
left undecided so these documents can guide design work and a technology evaluation.

## Contents
- `docs/concept-brief.md` — one-page pitch, pillars, non-goals
- `docs/gdd.md` — Game Design Document
- `docs/rules-spec.md` — rules, keywords, edge cases, resolution order
- `docs/card-schema.md` — data schema + effect DSL
- `docs/card-list.md` — master card list conventions
- `docs/ux-flow.md` — screen map, touch interactions, wireframes
- `docs/tdd.md` — Technical Design Document (stack TBD)
- `docs/tech-stack-evaluation.md` — compare engine/framework candidates
- `docs/asset-manifest.md` — sprite/SFX/music manifest
- `docs/analytics-plan.md` — event taxonomy and KPIs
- `docs/launch-checklist.md` — Play Store launch checklist
- `docs/qa-test-plan.md` — QA matrix and flows
- `project-context.md` — repo-root context for AI coding assistants

## Suggested order
1. concept-brief → gdd → rules-spec
2. card-schema → card-list
3. ux-flow → tech-stack-evaluation → tdd
4. asset-manifest → analytics-plan
5. qa-test-plan → launch-checklist
