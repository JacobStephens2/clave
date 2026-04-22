# Project Context — <Game Title>

## Overview
A card game targeting Android. Tech stack is not yet decided — see
`docs/tech-stack-evaluation.md` and `docs/tdd.md`.

## Architecture Rules (stack-agnostic)
- Logic layer is decoupled from rendering/presentation
- All card effects are data-driven via the effect DSL (see `docs/card-schema.md`)
- State changes flow through a single, observable event channel
- Deterministic RNG, seeded per match, to enable replays and testing

## Conventions
- Card IDs: `<type>_<###>`
- Asset naming: see `docs/card-schema.md`

## Do
- Load card data from external content files
- Add new effects to the DSL registry rather than special-casing in UI code

## Don't
- Hardcode card behavior in scene/view files
- Mutate card definitions at runtime

## Key Docs
- `docs/gdd.md`, `docs/rules-spec.md`, `docs/tdd.md`,
  `docs/card-schema.md`, `docs/tech-stack-evaluation.md`
