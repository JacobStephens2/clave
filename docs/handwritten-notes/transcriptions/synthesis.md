# Synthesis — Dance card game concept

Synthesized from the 2026-04-18 brainstorm notes (plane from San Juan to Philly). See paired scans and page transcripts in this folder and `../scans/`.

## Vision

A focused, cooperative, two-player card game about partner dancing — playable by Jacob and Mel on their Android phones, over local connection (no internet required, designed for flights). Starts narrow (salsa) so it can have more fun gameplay, in contrast to the prior, over-ambitious **Clowder & Crest** project.

The game doubles as a learning tool: players pick up real dance move names, styles, and transitions as they play. Art for the initial salsa version of the game will be in the Afro-Caribbean Figurative Expressionist tradition. As different dance styles are brought in, and eventually a fusion variation mixing styles together is created, different dance styles can have different art styles matching those dance styles.

## Core design pillars

- **Cooperative, asymmetric roles** — one player is Lead, the other is Follow. Asymmetry reflects the real dance roles, but kept light enough that players learn moves (the primary goal) rather than wrestle with role-specific complexity. At least a distinction between the lead and follow is that the lead plays the first card in a dance.
- **Phone-native, local multiplayer** — offline-friendly; two Android phones, no server.
- **Narrow scope first** — salsa only at launch. Other genres layer in later, with some cards shared across genres.
- **Art as a personal goal** — hand-drawn artwork fleshed out with AI tools.
- **Music** — genre-appropriate soundtrack, possibly generated via Suno.

## Card types

Three card categories surfaced in the notes:

1. **Position** — the state the dancers are in (open, closed, shines/disconnected, promenade, cuddle).
2. **Move** — transitions and turns (e.g. follow outside turn, lead outside turn, inside turn).
3. **Flourish / Flare** — embellishments played on top of a move (e.g. hand twist), often with requirements like "free hand."

### Anatomy of a card

- Move name / artwork
- Power text (e.g. "Any position can follow this move")
- Requirements to play (e.g. `[position] Closed`)
- Costs / rewards:
  - cost: energy cost?
  - rewards: performance points? style points? experience points? (more style points if the move is harder, or if it is more advanced - comes from lessons). Experience points could be used to gain new moves / cards, and style points could be the ultimate game score.

## Game state

- **Joint dance state** visible to both players: current position, most recent move, any active flourish.
- **Hand of live cards on screen** for each player (phone view).
- **Music of genre playing** in the background.
- **Follow market / lessons / inspiration** — a shared display of two cards available to pick up, representing learning new moves mid-dance.

## Hand size

- Leaning toward **3 cards for Follow** as a minimum-viable decision space, possibly having one position, move, and flourish card at a time; grow if it feels too constrained.
- Lead could have a larger hand (TBD). The asymmetry is that the Lead initiates while the Follow responds with limited but meaningful choices.

## Round / game length

- Round ends after **X cards played**, representing song length.
- Exploring **20–30 cards per round** (~10–15 decisions per player), roughly matching the length of a salsa song.
- Starting deck size to explore: ~10 cards.
- **Losing condition (tentative):** you lose if you can't play a move that connects to the board state.

## Scoring & challenge

- **Points** for performance and style; synergies across the song drive the score.
- **Deck-building mid-round** — pick up new moves from a shared market of "lessons"; maybe you don't see what your partner picks, so you have to watch and adapt.
- **Time pressure** — a per-turn time limit simulates the real-time feel of dancing.
- **Reference games**: Fox in the Forest, Regicide, Pandemic — coop or trick-taking games with pressure and constrained hands.

## Transitions between positions

- Dedicated **transition move** cards let you move e.g. open → closed. No style points awarded, but they unlock other positions.
- Example: closed → open via a pass-by.
- Opening a new position could trigger **card draw** (e.g. moving to open position lets you draw 2), incentivizing variety.

## Symmetry decision

Leaning symmetric. If the primary goal is learning moves, deep lead/follow asymmetry (granular cards like "left hand up" in the lead deck, paired with inside/outside turn responses in the follow deck) adds complexity without adding learning value — the follow often has limited choice in those situations. Keep it symmetric enough that both players meaningfully decide and learn. It's more that the players are creating a dance together and less of simulating lead and follow initiation and response.

## Competitive 4 Player Mode

Two sets of two players could play side by side, and each partnership could try to get a higher score than the other, or if who you are playing with / dancing with you individually get points from your dance with them, then you see who has the higher score at the end, sort of like a dance competition where you can win individually but can dance with different partners. I'm just worried about competitive scoring in a two player game incentivizing players to not play to form synergies for fear of helping their partner get points, whereas in a four player game, you would be incentivized to get as many points as you can, even if it means helping your particular partner out, so that overall you end up getting the most style points and winning. Or you could just compete your partnership versus their partnership rather than switching partners.

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
