# Unity vs. Web Implementation Report

**Date:** 2026-07-19
**Subject:** Comparing a Unity/C# “Hearthstone-style” Clave client with the
browser/TypeScript “Board Game Arena-style” Clave application

## Executive summary

Clave has now implemented the same representative interaction in two systems:

1. a macOS-first Unity 6.5 client written in C# and UI Toolkit; and
2. the responsive React/TypeScript web application defined as v1 in the
   [governing plan](plans/clave-plan.md).

The feature used for this comparison is an opening play made by dragging a
Position card to the dance floor and then dragging a compatible Move card. Both
clients preserve the same important rule: staging the Position is presentation
state only, and the game receives one atomic opening action after the Move is
dropped.

The comparison favors the web implementation as Clave's primary system. Clave is
currently a deterministic, turn-based card game whose central technical needs
are hidden information, responsive hand presentation, replayable actions,
hot-seat privacy, synchronized two-device play, reconnection, and easy household
distribution. Those needs align closely with the existing browser architecture.

Unity offers the higher ceiling for a presentation-led product: animated dancers,
tempo-synchronized effects, cinematic card movement, spatial audio, particles,
lighting, and a native desktop feel. That ceiling matters only if embodied dance
presentation becomes a central part of the game rather than an enhancement to a
primarily card-driven experience.

The recommended direction is therefore **Board Game Arena underneath,
Hearthstone on top**: retain one authoritative action/state model and web-first
game service, while treating Unity as an optional high-fidelity client or
prototype. Maintaining independent TypeScript and C# rules engines as equal
authorities would create the largest long-term cost and correctness risk.

## Scope and terminology

“Hearthstone-style” and “Board Game Arena-style” are used here as product and
implementation archetypes, not as claims that the Clave prototypes reproduce
either company's complete production architecture.

- **Hearthstone-style** means a Unity rich client in which custom presentation,
  animation, audio, spatial composition, and tactile input are major product
  assets.
- **Board Game Arena-style** means a browser-first, state-driven board-game
  interface with lightweight distribution and rules enforced through an
  authoritative game model.

The distinction is principally about client development and product emphasis.
Production online games in either category can use authoritative servers. The
current Clave Unity application is a local hot-seat prototype with its own C#
engine; it is not yet a networked equivalent of the web application.

## The controlled feature comparison

The sequential opening interaction provides a useful case study because it
touches input, rendering, temporary UI state, legal-action filtering, rules
dispatch, cancellation, feedback, persistence, and testing.

The required behavior is:

1. At the start of a dance with an empty floor, only Position cards that belong
   to at least one legal opening pair are draggable.
2. Dropping a Position stages it visually without changing the engine or saved
   game.
3. The staged Position disappears from the hand and appears in the Position
   floor slot.
4. Only Move cards compatible with that exact Position remain draggable.
5. Dropping a compatible Move submits the existing atomic opening action.
6. The player can return the staged Position to the hand.
7. The interface does not replace the second drag with a list of pair buttons.

Both implementations meet this behavioral contract. They differ substantially
in how much machinery is owned by the application and where correctness is
verified.

## Side-by-side development experience

| Dimension                     | Unity/C# client                                                                                                                                    | React/TypeScript web client                                                                                        |
| ----------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| Primary mental model          | Manipulate a retained visual tree and respond to pointer lifecycle events.                                                                         | Derive DOM output and interactivity from snapshots plus local React state.                                         |
| Drag input                    | Explicit pointer down, move, and up callbacks; pointer capture; movement threshold; preview positioning; coordinate conversion; floor hit-testing. | Native browser drag events; a card instance ID in `dataTransfer`; React drop handlers; CSS feedback.               |
| Temporary opening state       | `_pendingOpenPositionInstanceId` is held by the presentation object and validated before rendering.                                                | `pendingOpenPositionId` is held in `useState`; legal draggable IDs and the staged card are derived with `useMemo`. |
| Rendering                     | `RenderGame()` rebuilds UI Toolkit elements and USS classes are applied imperatively.                                                              | React re-renders components from `PlayerSnapshot`, props, and local state; CSS classes express visual states.      |
| Legal-action filtering        | C# presentation filters legal actions from the parallel C# engine.                                                                                 | React filters `PlayerSnapshot.legalActions` produced by the existing TypeScript engine.                            |
| Completed play                | The C# client applies its `PlayOpen` action after the second drop.                                                                                 | The browser dispatches the existing TypeScript `PLAY_OPEN` action after the second drop.                           |
| Iteration loop                | Script compilation, asset import, Editor/native launch, and UI Toolkit inspection.                                                                 | Vite hot module replacement, browser developer tools, and immediate CSS/React feedback.                            |
| Main debugging concerns       | Pointer capture, visual/world coordinates, layout timing, hit bounds, Unity asset state, native build logs.                                        | Hook lifetime, derived-state dependencies, event bubbling, CSS breakpoints, browser input differences.             |
| Automated interaction testing | Engine and EditMode coverage are straightforward; native pointer gestures require a heavier harness or a manual smoke test.                        | Playwright performs the actual two-drag gesture in desktop and touch-emulated Chrome.                              |
| Distribution                  | Build, sign/notarize, download, install, and update a macOS application.                                                                           | Open a URL; the next reload receives the current client.                                                           |
| Accessibility baseline        | Focus, keyboard/controller navigation, and assistive semantics need deliberate Unity implementation.                                               | DOM roles, focus behavior, keyboard input, and browser accessibility provide a stronger default foundation.        |

## Unity/C#: what coding feels like

Unity development feels like building a physical card table. The input path is
concrete: capture a pointer, decide whether movement crossed the drag threshold,
move a preview, determine whether its release point falls inside the floor, and
then either stage or play the card. This produces strong control over tactile
behavior, but the application owns most of the mechanism.

The relevant implementation is concentrated in
[`ClaveApp.cs`](../unity/Clave/Assets/Scripts/Presentation/ClaveApp.cs), including:

- `PointerDownEvent`, `PointerMoveEvent`, and `PointerUpEvent` registration;
- explicit drag state and pointer identity;
- a drag threshold to separate click-to-inspect from drag-to-play;
- pointer capture and release;
- a floating card preview;
- `worldBound.Contains(...)` floor collision;
- staged Position validation and cancellation; and
- a full UI rebuild after presentation or engine state changes.

This is more code than the conceptual game interaction suggests, but that code is
also the foundation for richer physicality. It can be extended into snapping,
momentum, layered animation, particles, sound cues, card trails, controller input,
or a dancer performing the selected movement.

Unity's main architectural disadvantage is not pointer handling; it is the
parallel C# rules implementation. New rules, bug fixes, content interpretation,
replay semantics, and edge cases must remain behaviorally equivalent to the
TypeScript rules of record. Without automated cross-engine conformance fixtures,
the two games can silently diverge while each appears internally correct.

## React/TypeScript: what coding feels like

Web development feels like describing how a known game state should appear. The
browser owns native drag dispatch, and React owns the relationship between
temporary staging state and rendered components. The application primarily
answers three questions:

1. Which card instance IDs may be dragged now?
2. What should the floor and hand look like while a Position is staged?
3. Which existing legal action corresponds to the second drop?

The implementation is split across:

- [`DanceCard.tsx`](../packages/client/src/components/DanceCard.tsx) for reusable
  draggable-card attributes and callbacks;
- [`GameScreen.tsx`](../packages/client/src/components/GameScreen.tsx) for staged
  state, legal-action derivation, floor drop handling, cancellation, and layout;
- [`styles.css`](../packages/client/src/styles.css) for playable, dragging,
  drop-target, and staged-floor feedback; and
- [`hotseat.spec.ts`](../packages/client/e2e/hotseat.spec.ts) for the complete
  Position-then-Move browser gesture.

The browser implementation has more prop and state plumbing across components,
but less low-level input machinery. It also connects directly to the existing
`PlayerSnapshot` boundary and the existing `PLAY_OPEN` action. No second rules
interpretation is introduced.

The tradeoff is that browser-native drag behavior is less uniformly expressive
than a completely custom Unity gesture system. Mouse, touch, scrolling, drag
images, and browser accessibility can require different treatments as the
interaction becomes more elaborate. For Clave's current two-step card placement,
however, the native mechanism is sufficient and directly testable.

## Implementation size and verification evidence

Raw line counts are not a measure of quality, but they show where each platform
requires application-owned machinery.

### Unity drag work

The initial Unity drag commit (`222d377`) changed 321 lines in and 10 lines out.
The sequential Position-then-Move follow-up (`7430ede`) changed 134 lines in and
68 lines out. Together they added approximately 455 lines and removed 78 across
presentation code, styles, validation, documentation, and task tracking.

Of those additions, approximately 432 were in `ClaveApp.cs` and `Clave.uss`. The
larger input implementation includes capabilities the first web patch does not
need to own, particularly explicit preview movement and pointer-level hit-testing.

Verification completed for the Unity version included:

- a successful native macOS application build;
- 6 passing Unity EditMode tests;
- 30 passing compiled C# verification checks;
- the static Unity project validator; and
- a native two-drag interaction smoke test, including the staged and completed
  states.

### Web drag work

The web patch changed 372 lines in and 80 lines out across the card component,
game screen, CSS, end-to-end test, and task tracking. Forty-seven added lines are
the dedicated browser interaction scenario.

Verification completed for the web version included:

- 46 passing unit and property tests;
- all workspace TypeScript checks;
- lint;
- a successful production build and bundle-size check; and
- 12 passing Playwright scenarios across desktop and touch-emulated Chrome,
  including the actual sequential two-drag opening.

The most important testing difference is not the total number of checks. The web
suite can cheaply reproduce the real pointer-level user journey as part of the
ordinary end-to-end run. The Unity prototype currently verifies the same journey
through native smoke testing rather than a comparable automated UI harness.

## Architectural implications for Clave

### Rules authority

The web application already follows the intended architecture: headless,
deterministic rules produce legal actions and per-role snapshots; rendering does
not infer private or illegal game state. Hot-seat persistence and online rooms use
the same action vocabulary.

The Unity application follows the same conceptual separation, but implements it
again in C#. That is appropriate for evaluating a native prototype. It becomes
risky if both engines continue to evolve independently.

For a production rich client, Unity should ideally consume the same
server-authoritative action/snapshot protocol as the web client. If offline native
play remains a requirement, the project would need one of the following:

- a single portable engine shared by both clients;
- generated bindings around one engine implementation;
- an embedded local rules service; or
- comprehensive cross-language replay and legal-action conformance fixtures.

Simply maintaining two handwritten engines is the easiest short-term path and
the most expensive long-term path.

### Multiplayer and hidden information

The web version already has server-authoritative two-device rooms, private seat
tokens, per-role snapshots, sequence checks, transactional action persistence,
restart rehydration, and reconnect behavior. A Unity multiplayer client would
need to implement the protocol and all connection lifecycle presentation before
it reached feature parity.

This work is possible, but it does not improve the card game's rules. It only
pays off when the Unity presentation itself materially improves the experience.

### Content and live iteration

Both systems use data-driven content, but browser delivery makes balance and UX
iteration substantially cheaper. A web deployment updates the shared household
experience at one URL. A native build adds version distribution and compatibility
questions, especially when a saved game or multiplayer server expects a newer
engine/content version.

### Presentation ceiling

Unity has the decisive advantage when Clave becomes an audiovisual dance
experience rather than a card table about dance. Examples include:

- dancer avatars performing the selected Position, Move, and Flourish;
- animation blending between compatible salsa figures;
- beat- and phrase-synchronized effects;
- a spatial dance floor with camera work;
- reactive music, lighting, particles, and haptics; and
- storefront-quality native presentation.

Those features align with Unity's strengths and can justify its additional
engineering and release overhead. A glowing draggable card by itself does not.

## Decision matrix

| Product priority                   | Better primary approach | Reason                                                                        |
| ---------------------------------- | ----------------------- | ----------------------------------------------------------------------------- |
| Fast rules and balance iteration   | Web                     | One engine and instant delivery shorten the feedback loop.                    |
| Hot-seat on any available device   | Web                     | No install and an existing responsive layout.                                 |
| Two-device household multiplayer   | Web                     | The authoritative room architecture already exists.                           |
| Hidden-hand correctness and replay | Web                     | `PlayerSnapshot` and the action log are already the system boundary.          |
| Automated cross-device UI coverage | Web                     | Browser automation directly exercises the interaction.                        |
| macOS-native desktop feel          | Unity                   | Native windowing and a purpose-built application shell.                       |
| Highly tactile custom card motion  | Unity                   | Full control over input, previews, timing, and effects.                       |
| Animated dance instruction         | Unity                   | Character animation and audiovisual synchronization are first-class concerns. |
| Lowest release and update friction | Web                     | A URL replaces native packaging and client update management.                 |
| One maintainable rules authority   | Web today               | The TypeScript engine already governs web hot-seat and online play.           |

## Recommendation

Continue treating the responsive web application as Clave v1 and the source of
truth for game behavior. Use the Unity build as a deliberate product experiment:
evaluate whether richer spatial and audiovisual presentation creates enough
additional delight, clarity, or dance-learning value to justify a second client.

Do not choose Unity solely because it can make card dragging feel more native.
The web version now demonstrates the same game interaction with less low-level
input ownership, stronger automated UI coverage, and direct reuse of the existing
engine and multiplayer boundaries.

Reconsider Unity as the primary client if playtests show that players want to
watch, hear, or learn the dance through the application—not merely manipulate
cards representing it. At that point, preserve the browser architecture's best
property: one authoritative rules and action service. Unity should become a rich
presentation client for that service rather than an independent version of the
game.

In concise form:

> Build Clave like Board Game Arena until the dance itself demands Hearthstone.

## Suggested next experiments

1. Run the same opening and one complete turn in both clients with the same two
   players; record preference, clarity, speed, and error rate.
2. Add one presentation feature that clearly favors Unity—such as a dancer
   performing the selected Move—and test whether it changes preference.
3. Keep a shared action replay fixture and require both engines to produce the
   same legal actions and resulting public state while the C# prototype exists.
4. Measure iteration time for one rules change and one visual change in both
   systems rather than relying only on code volume.
5. If Unity continues beyond prototyping, define the action/snapshot network
   protocol before adding more independent C# rules.
