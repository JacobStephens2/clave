# Synthesis — Dance card game concept

Synthesized from the 2026-04-18 brainstorm notes (plane from San Jose to Philly).

## Vision

A focused, cooperative, two-player card game about partner dancing — playable by Jacob and Mel on their phones, over local connection (no internet required, designed for flights). Starts narrow (salsa) so it actually ships, in contrast to the prior, over-ambitious **Clowder & Crest** project.

The game doubles as a learning tool: players pick up real dance move names, styles, and transitions as they play. Art is hand-drawn cats, partly as a way for Jacob to practice drawing cats; different cat breeds can map to different dance genres/regions.

## Core design pillars

- **Cooperative, asymmetric roles** — one player is Lead, the other is Follow. Asymmetry reflects the real dance roles, but kept light enough that players learn moves (the primary goal) rather than wrestle with role-specific complexity.
- **Phone-native, local multiplayer** — offline-friendly; two phones, no server.
- **Narrow scope first** — salsa only at launch. Other genres layer in later, with some cards shared across genres.
- **Art as a personal goal** — cat-themed hand-drawn characters; breeds tied to dance styles.
- **Music** — genre-appropriate soundtrack, possibly generated via Suno.

## Card types

Three card categories surfaced in the notes:

1. **Position** — the state the dancers are in (open, closed, shines/disconnected, promenade, cuddle).
2. **Move** — transitions and turns (e.g. follow outside turn, lead outside turn, inside turn).
3. **Flourish / Flare** — embellishments played on top of a move (e.g. hand twist), often with requirements like "free hand."

### Anatomy of a card

- Move name / artwork
- Power text (e.g. "if transition move, any position can follow this move")
- Requirements to play (e.g. `[position] Closed`)
- Costs / rewards:
  - energy cost?
  - performance points?
  - style points? (more style points if the move is harder, or if it comes from a lesson)

## Game state

- **Joint dance state** visible to both players: current position, most recent move, any active flourish.
- **Hand of live cards on screen** for each player (phone view).
- **Music of genre playing** in the background.
- **Follow market / lessons / inspiration** — a shared display of two cards available to pick up, representing learning new moves mid-dance.

## Hand size

- Leaning toward **2 cards for Follow** as a minimum-viable decision space; grow if it feels too constrained.
- Lead may have a larger hand (TBD). The asymmetry is that the Lead initiates while the Follow responds with limited but meaningful choices.

## Round / game length

- Round ends after **X cards played**, representing song length.
- Exploring **20–30 cards per round** (~10–15 decisions per player), roughly matching the length of a salsa song.
- Starting deck size to explore: ~10 cards.
- **Losing condition (tentative):** you lose if you can't play a move that connects to the board state.

## Scoring & challenge

- **Points** for performance and style; synergies across the song drive the score.
- **Deck-building mid-round** — pick up new moves from a shared market; you don't see what your partner picks, so you have to watch and adapt.
- **Time pressure** — a per-turn time limit simulates the real-time feel of dancing.
- **Reference games**: Fox in the Forest, Regicide, Pandemic — coop or trick-taking games with pressure and constrained hands.

## Transitions between positions

- Dedicated **transition move** cards let you move e.g. open → closed. No style points awarded, but they unlock other positions.
- Example: closed → open via a pass-by.
- Opening a new position could trigger **card draw** (e.g. moving to open position lets you draw 2), incentivizing variety.

## Symmetry decision

Leaning symmetric. If the primary goal is learning moves, deep lead/follow asymmetry (granular cards like "left hand up" in the lead deck, paired with inside/outside turn responses in the follow deck) adds complexity without adding learning value — the follow often has no real choice in those situations. Keep it symmetric enough that both players meaningfully decide and learn.

## Open questions

- Exact hand sizes for Lead vs. Follow.
- Deck size and round length — needs playtesting.
- Real-time vs. turn-based — notes flirt with a real-time dancing element but a turn-based card game is the working default.
- How flourish requirements ("free hand") are tracked in state.
- Whether the game is purely cooperative or has any pressure/opponent analog (the notes lean cooperative, citing Regicide/Pandemic).

## Next steps implied by the notes

- Prototype a salsa-only deck: positions (open, closed, shines, promenade, cuddle), a handful of moves, a few transitions, a few flourishes.
- Sketch the phone UI: joint dance state on top, hand at bottom, follow market in view.
- Start drawing cats.
