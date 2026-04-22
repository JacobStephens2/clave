# MDA: A Formal Approach to Game Design and Game Research

*Original paper by Robin Hunicke, Marc LeBlanc, and Robert Zubek (2004), presented at the Game Developers Conference workshops between 2001–2004.*

> This document is an original summary and exposition of the MDA framework in my own words. It is not a reproduction of the original paper. For the authoritative text, see the original PDF: <http://www.cs.northwestern.edu/~hunicke/MDA.pdf>.

---

## 1. Introduction (summary)

The MDA framework was created to bridge the gap between game **design**, **development**, **criticism**, and **academic research**. The authors argue that by treating games as artifacts with formal, analyzable components — not just media experiences — designers can reason about them more rigorously, iterate more effectively, and communicate more clearly with collaborators across disciplines.

Games differ from linear media (books, film, music) because their "content" is *behavior*, not a fixed stream of information. The designer creates a system; the player's interaction with that system produces the experience. MDA offers a vocabulary for this indirect relationship.

## 2. The Three Components

MDA decomposes a game into three layers:

### 2.1 Mechanics
The particular components of the game at the level of data representation and algorithms. These are the rules and systems the designer literally writes down or codes: movement rules, combat resolution, card shuffling, economic exchange rates, win conditions.

### 2.2 Dynamics
The run-time behavior of the mechanics acting on player inputs and each other's outputs over time. Dynamics are what *happens* when the rules are set in motion — emergent strategies, tensions, pacing curves, snowball effects, negotiation, bluffing.

### 2.3 Aesthetics
The desirable emotional responses evoked in the player when interacting with the game. "Aesthetics" here does not mean visual style; it means the felt experience — the *why-this-is-fun*.

## 3. Two Perspectives on the Same Artifact

A central insight of MDA is that **designers and players traverse these layers in opposite directions**:

- **Designer's path:** Mechanics → Dynamics → Aesthetics. The designer controls rules, hoping certain dynamics will emerge, which in turn produce a target feel.
- **Player's path:** Aesthetics → Dynamics → Mechanics. The player first notices how the game *feels*, then perceives the *patterns of play*, and only later (if ever) reasons explicitly about the underlying *rules*.

This asymmetry means the designer faces a **second-order design problem**: you do not directly author the experience; you author a system whose emergent behavior produces it.

## 4. Aesthetics: The "8 Kinds of Fun"

Rather than the vague word "fun," MDA proposes a taxonomy of aesthetic goals. A given game typically targets several of these at varying intensities:

1. **Sensation** — game as sense-pleasure (sight, sound, tactile feedback).
2. **Fantasy** — game as make-believe, inhabiting another role or world.
3. **Narrative** — game as unfolding drama or story.
4. **Challenge** — game as obstacle course to master.
5. **Fellowship** — game as social framework, community, cooperation.
6. **Discovery** — game as uncharted territory to explore.
7. **Expression** — game as a canvas for self-discovery or creativity.
8. **Submission** — game as pastime, a pleasant routine to sink into.

Using this vocabulary, designers can describe a game's intent precisely: e.g., chess is Challenge-heavy; *The Sims* emphasizes Discovery, Expression, and Fantasy; *Quake* deathmatch leans on Challenge, Sensation, and Fellowship.

## 5. Dynamics: Models of Emergent Play

Dynamics are where mechanics produce aesthetics. The paper encourages thinking about dynamics in terms of *models* borrowed from other disciplines:

- **Feedback systems** — positive feedback (snowballing leads, rich-get-richer) and negative feedback (rubber-banding, catch-up mechanics) govern pacing and tension.
- **Information economies** — who knows what, and when, creates dynamics like bluffing (hidden info) or tension (revealed timers).
- **Resource flow** — how currencies, actions, or tokens circulate shapes strategic depth.
- **Predictability vs. surprise** — the ratio of deterministic to stochastic outcomes tunes engagement.

By modeling dynamics, designers can *predict* how a mechanical change will ripple into the player experience.

## 6. Mechanics: The Designer's Lever

Mechanics are the only layer designers directly manipulate. Examples from the paper include:

- Shuffling and dealing in card games.
- Turn order and phase structure in board games.
- Hitpoints, cooldowns, and damage curves in action games.
- Auction or bidding subsystems in strategy games.

Small mechanical tweaks (e.g., changing a respawn timer) often produce outsized dynamic and aesthetic consequences (e.g., shifting a game from tense skirmishes to lopsided stomps).

## 7. Iterative Design Through MDA

The framework supports iterative tuning:

1. Identify the target **aesthetic** (what should players feel?).
2. Hypothesize **dynamics** that would produce that feeling.
3. Author or adjust **mechanics** expected to yield those dynamics.
4. Playtest, observe the *actual* dynamics and aesthetics, and iterate.

Each component becomes a "lens" for inspecting the game when something feels off: Is the aesthetic miscalibrated? Are the dynamics not emerging as expected? Are the mechanics themselves broken or unclear?

## 8. Conclusion (summary)

MDA is not a theory of what makes games good; it is a shared *vocabulary and methodology* for reasoning about them. Its goal is to let designers, critics, and researchers discuss games with precision and to make the iterative design process more deliberate.

---

# Appendix: Clarifications and How the Thinking Has Evolved

*This appendix is my own commentary, written in 2026, reflecting how MDA has been interpreted, critiqued, and extended by the game-design community in the two decades since the paper appeared.*

## A. Common Misreadings of MDA

- **"Aesthetics = art style."** This is the single most frequent misreading. In MDA, aesthetics are *emotional responses*, not visuals. A game's art direction contributes to Sensation, but Sensation is only 1 of 8 aesthetic categories.
- **"Mechanics = game features."** Mechanics are closer to *atomic rules* than to features. "Double jump" is a mechanic; "platforming" is a genre-level abstraction that bundles many mechanics and dynamics.
- **"The 3 layers are sequential development stages."** They are *lenses on a single artifact*, not phases of a project plan. You consider all three constantly.

## B. Where MDA Has Been Critiqued

1. **Aesthetics taxonomy is incomplete.** The 8 kinds of fun omit important modern experiences like *abnegation* (mindless grinding as relaxation), *learning/mastery* as distinct from challenge, and *parasocial* aesthetics from streamer-era play. Extensions like the **DDE framework** (Design, Dynamics, Experience) and Lazzaro's **4 Keys to Fun** address some of these gaps.
2. **Emergence is underspecified.** MDA tells you dynamics emerge from mechanics but offers limited formal tools for predicting *which* dynamics. Later work in systems-thinking game design (e.g., Adams & Dormans' *Game Mechanics: Advanced Game Design*) adds concrete modeling techniques like Machinations diagrams.
3. **Hard to apply to narrative-first games.** MDA originated in a board/arcade/systems context. Story-driven or walking-sim experiences benefit from complementary frameworks (e.g., **Elemental Tetrad**: Mechanics, Story, Aesthetics, Technology — Schell).
4. **"Second-order design" can be overstated.** In practice, many experiential elements (cutscenes, tutorials, UI feedback) are fairly *first-order* — you can author the moment directly.

## C. Useful Extensions and Companions

- **DDE (Design, Dynamics, Experience)** — Walk, Görgü, Roden (2017). Reframes the designer side as explicit "design" (blueprint, mechanics, interface) to address MDA's ambiguity about what counts as a mechanic.
- **Elemental Tetrad** — Jesse Schell, *The Art of Game Design*. Adds Story and Technology as first-class components.
- **4 Keys to Fun** — Nicole Lazzaro. Hard Fun, Easy Fun, Serious Fun, People Fun — often used alongside MDA's 8 Kinds.
- **Machinations** — Joris Dormans. A visual formalism for modeling feedback loops, resource flows, and emergent dynamics.
- **Skill Atoms / Chunks** — Daniel Cook. A finer-grained way to think about how individual mechanics teach and reward the player.

## D. How Modern Designers Actually Use MDA

In contemporary practice, MDA is less a step-by-step method and more a *diagnostic shorthand*:

- In playtests: "It's not landing because the Challenge aesthetic we want requires a negative-feedback dynamic we haven't built yet."
- In pitches: Name the target aesthetics first, then the signature mechanics, leaving dynamics to emerge during prototyping.
- In postmortems: Trace a shipped problem back through the layers to locate whether the fix belongs in rules, in tuning, or in framing.

## E. A Worked Example: A 2D Platformer Wall-Jump

Because platformers are a familiar domain, consider the classic wall-jump:

- **Mechanic:** On collision with a wall tile while airborne, if the jump button is pressed within a 120 ms window, apply an impulse of (±X, +Y) away from the wall.
- **Dynamics that emerge:** Vertical traversal of narrow shafts; risk/reward of chaining jumps; expressive movement tech (wall-kicks into dashes); level designers gating progression behind mastery.
- **Aesthetics served:** Primarily **Challenge** (mastery) and **Expression** (personal style of movement), with **Sensation** from juicy feedback (screen shake, dust particles, crunchy SFX).

Tuning the 120 ms window alone changes the dynamic from "forgiving traversal" (longer window) to "precision tech" (shorter window), which in turn shifts the aesthetic weight between Submission/Discovery and Challenge/Expression. That single number is the designer's lever; the player never sees it, but they feel it in every jump.

## F. Takeaway

MDA endures because it gives designers a way to *name* the indirectness of their craft. You write rules; players feel meaning; the miracle in the middle is called dynamics. Whatever framework you pair it with, the habit of asking "which layer is this problem really on?" remains one of the most useful instincts in game design.

---

*Original paper reference:*
Hunicke, R., LeBlanc, M., & Zubek, R. (2004). *MDA: A Formal Approach to Game Design and Game Research.* Proceedings of the AAAI Workshop on Challenges in Game AI. <http://www.cs.northwestern.edu/~hunicke/MDA.pdf>
