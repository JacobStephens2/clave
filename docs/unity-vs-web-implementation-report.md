# Unity vs. Web Implementation Report

**Date:** 2026-07-19
**Subject:** Comparing a Unity/C# “Hearthstone-style” Clave client with the
browser/TypeScript “Board Game Arena-style” Clave application

## Executive summary

Clave has now implemented the same representative game and presentation work in
two systems:

1. a macOS-first Unity 6.5 client written in C# and UI Toolkit; and
2. the responsive React/TypeScript web application defined as v1 in the
   [governing plan](plans/clave-plan.md).

The original controlled feature was an opening play made by dragging a Position
card to the dance floor and then dragging a compatible Move card. The comparison
now also includes two animation experiments implemented in both clients:

1. a purchased lesson card flying from the market to the discard pile; and
2. articulated Lead and Follow figures demonstrating a representative Position,
   Move, and Flourish.

The added experiments matter because they test the central hypothesis behind a
Hearthstone-style client: that richer presentation work should be materially
stronger in Unity.

The comparison favors the web implementation as Clave's primary system. Clave is
currently a deterministic, turn-based card game whose central technical needs
are hidden information, responsive hand presentation, replayable actions,
hot-seat privacy, synchronized two-device play, reconnection, and easy household
distribution. Those needs align closely with the existing browser architecture.

Unity still offers the higher ceiling for a presentation-led product:
professionally rigged dancers, animation blending, tempo-synchronized effects,
cinematic camera movement, spatial audio, particles, lighting, and a native
desktop feel. The prototypes showed that this advantage is not automatic. When
both clients construct flat figures and card effects directly in UI code, React
and CSS are faster to iterate and easier to verify. Unity's ceiling becomes an
actual advantage only after Clave invests in an animation asset pipeline such as
rigged sprites or 3D characters, Animator controllers, Timeline, inverse
kinematics, and authored effects.

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

| Dimension                     | Unity/C# client                                                                                                                                    | React/TypeScript web client                                                                                          |
| ----------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| Primary mental model          | Manipulate a retained visual tree and respond to pointer lifecycle events.                                                                         | Derive DOM output and interactivity from snapshots plus local React state.                                           |
| Drag input                    | Explicit pointer down, move, and up callbacks; pointer capture; movement threshold; preview positioning; coordinate conversion; floor hit-testing. | Native browser drag events; a card instance ID in `dataTransfer`; React drop handlers; CSS feedback.                 |
| Temporary opening state       | `_pendingOpenPositionInstanceId` is held by the presentation object and validated before rendering.                                                | `pendingOpenPositionId` is held in `useState`; legal draggable IDs and the staged card are derived with `useMemo`.   |
| Rendering                     | `RenderGame()` rebuilds UI Toolkit elements and USS classes are applied imperatively.                                                              | React re-renders components from `PlayerSnapshot`, props, and local state; CSS classes express visual states.        |
| Code-drawn animation          | C# holds references to visual elements, schedules updates, calculates transforms each frame, and cancels schedules during UI rebuilds.             | React selects a choreography mode; CSS keyframes animate body parts and the browser owns interpolation.              |
| Animation mode switching      | Rebuilding the visual tree during a click exposed an event-lifecycle bug; the rebuild had to be deferred until propagation finished.               | A local state change swaps `data-choreography`; React and CSS update without special click-lifecycle handling.       |
| Reduced-motion behavior       | Requires an explicit Unity preference and alternate-presentation policy; the prototype does not yet add one.                                       | One `prefers-reduced-motion` media query disables repeated motion across supported browsers.                         |
| Legal-action filtering        | C# presentation filters legal actions from the parallel C# engine.                                                                                 | React filters `PlayerSnapshot.legalActions` produced by the existing TypeScript engine.                              |
| Completed play                | The C# client applies its `PlayOpen` action after the second drop.                                                                                 | The browser dispatches the existing TypeScript `PLAY_OPEN` action after the second drop.                             |
| Iteration loop                | Script compilation, asset import, Editor/native launch, and UI Toolkit inspection.                                                                 | Vite hot module replacement, browser developer tools, and immediate CSS/React feedback.                              |
| Main debugging concerns       | Pointer capture, visual/world coordinates, layout timing, hit bounds, Unity asset state, native build logs.                                        | Hook lifetime, derived-state dependencies, event bubbling, CSS breakpoints, browser input differences.               |
| Automated interaction testing | Engine and EditMode coverage are straightforward; transient native UI motion and pointer gestures require a heavier harness or manual smoke test.  | Playwright performs the real gestures and asserts animation-active, arrival, cleanup, mode, and accessibility state. |
| Distribution                  | Build, sign/notarize, download, install, and update a macOS application.                                                                           | Open a URL; the next reload receives the current client.                                                             |
| Accessibility baseline        | Focus, keyboard/controller navigation, and assistive semantics need deliberate Unity implementation.                                               | DOM roles, focus behavior, keyboard input, and browser accessibility provide a stronger default foundation.          |

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

## Animation experiments: observed experience

The lesson-flight and dancer experiments test presentation directly rather than
inferring its cost from drag-and-drop work. The result is more nuanced than
“animation is easier in Unity.” The kind of animation and the rendering layer
matter more than the language name.

### Purchased lesson card to discard pile

Commit `61a559f` implemented the same 720-millisecond market-to-discard animation
in both clients. In both versions, the purchase remains one existing atomic game
action. The flying card is presentation state only, and the discard pile is the
authoritative destination.

The web implementation in
[`GameScreen.tsx`](../packages/client/src/components/GameScreen.tsx) performs four
steps:

1. capture the market card and discard target DOM rectangles;
2. dispatch the existing `BUY_LESSON` action;
3. wait until the received snapshot sequence exceeds the sequence at dispatch;
4. apply a CSS keyframe animation to a fixed-position clone, then remove it on
   `animationend`.

CSS owns the curved path, rotation, scale, fade, discard pulse, and reduced-motion
override. React owns confirmation and cleanup. The animation therefore does not
pretend a rejected or delayed action succeeded.

The Unity implementation in
[`ClaveApp.cs`](../unity/Clave/Assets/Scripts/Presentation/ClaveApp.cs) captures
UI Toolkit `worldBound` rectangles, converts them to root coordinates, applies
the C# engine action, checks that the sequence advanced, then schedules a callback
every 16 milliseconds. That callback calculates cubic easing, a sine-wave arc,
size, position, and opacity until the flight completes.

Both versions are understandable, but responsibility differs:

- the browser interpolates a declarative animation after React chooses its
  state;
- the Unity presentation calculates every frame and must pause its scheduled
  item whenever `RenderGame()` clears the visual tree.

The Unity approach gives precise runtime control and is a natural base for
particles, audio events, or a more elaborate animation queue. The web approach
was shorter to reason about, gained reduced-motion support almost for free, and
was easier to verify at the real UI boundary.

The web test observes the transient `.lesson-card-flight.flying` element, the
discard count changing to one, the receiving pulse, and eventual clone cleanup.
Unity compiled the complete presentation into a native macOS application and
passed its EditMode suite, but the repository still lacks an automated native UI
assertion for the in-flight frames.

### Articulated dancer sampler

Commit `19c46cb` completed the report's earlier suggested experiment: both
clients now show a Lead and Follow demonstrating three representative cases:

- Open Position, with partnered side-to-side marking;
- Follow Right Turn, with the Lead marking while the Follow travels and changes
  facing; and
- Arm Overhead (Lead), with a connected basic and overhead accent.

The sampler deliberately does not solve animation blending for every legal card
combination. It asks a narrower question: how does it feel to author and operate
the same articulated, code-drawn figures in each system?

On the web, [`DancerDemo.tsx`](../packages/client/src/components/DancerDemo.tsx)
describes a semantic stage, two figures, their heads, torsos, arms, and legs.
Local React state chooses `position`, `move`, or `flourish`. A
`data-choreography` attribute selects CSS keyframes for each figure and limb.
Matching cards already on the table supply the label; representative fallback
cards keep every sample available before those cards are played.

In Unity, `ClaveApp.cs` constructs equivalent UI Toolkit elements and stores a
`DancerRig` containing references to each limb. A scheduled callback derives a
2.4-second cycle from `Time.realtimeSinceStartup` and writes translation,
rotation, horizontal scale, connection-line geometry, and limb angles on every
frame. Changing tabs changes an enum and rebuilds the overlay.

#### Two prototype findings

First, a mathematically literal 360-degree rotation was wrong in both flat
renderers. It made the Follow tip sideways and clip out of the stage like a
rotating card. The successful representation kept the figure upright, moved it
through the slot, compressed it toward profile, flipped its facing direction,
and expanded it again. Live browser inspection exposed the problem quickly; the
same visual correction was then applied in both clients.

Second, the Unity tab switch exposed a retained-event lifecycle problem. The
button initially called `RenderGame()` synchronously while its click was still
propagating through the old visual tree. The old overlay handler could then close
the newly rebuilt sample. The final implementation removes the backdrop handler
and defers the mode rebuild until the click completes. React's equivalent change
is a local `setState` call and did not require event-lifecycle coordination.

These are not proofs that Unity is poor at animation. They show that **UI Toolkit
plus handwritten transform math is not the part of Unity that creates its
animation advantage**. The prototype did not use imported skeletons, Animator
state machines, Timeline, animation events, inverse kinematics, motion capture,
camera choreography, or the Visual Effect Graph. Without those systems, Unity
and the browser are both animating retained 2D elements, and the browser has the
more direct workflow.

### Size, iteration, and verification

The raw dancer commit added 1,259 lines and removed 6 across both clients,
validation, documentation, tests, and task tracking:

- the web client and its scenario added 751 lines: 121 in the React component,
  12 in the game-screen integration, 583 in CSS, and 35 in Playwright;
- the Unity presentation added 480 lines: 273 in C# and 207 in USS; and
- the remaining lines updated validation, documentation, and tracking.

The web version was easier to author despite its larger raw line count. Most of
that volume is declarative keyframes and selectors. This is also its principal
maintenance warning: one handcrafted choreography per card would turn the main
stylesheet into an animation database. Production web choreography should move
to generated motion data, Web Animations, SVG/canvas tooling, or reusable motion
primitives before the sample expands substantially.

Unity's C# is denser and more imperative. It owns timing, interpolation,
references, schedule cancellation, visual-tree reconstruction, and click
lifetime. That was slower for this sample, but a production Unity pipeline would
move much of the content out of `ClaveApp.cs` into animation assets and editor
workflows. Comparing handwritten C# transforms to CSS keyframes is therefore a
fair comparison of these prototypes, not a complete comparison of mature
character pipelines.

Final verification after the dancer experiment included:

- 46 passing TypeScript unit and property tests;
- 16 passing Playwright scenarios across desktop and mobile profiles, including
  animation mode and CSS animation-name assertions;
- successful lint, formatting, production build, and bundle-size checks;
- a fresh 108.9 MB macOS Unity application build;
- 6 passing Unity EditMode tests;
- Unity project validation for the three modes, articulated rig, and styles; and
- live visual inspection of the web and native Unity stages.

### Revised animation conclusion

For card flights, pulses, overlays, instructional silhouettes, and other motion
inside the current responsive table, the browser is presently the stronger Clave
implementation. It offers a faster feedback loop, accessibility hooks, cheap
responsive testing, and direct transient-state assertions.

Unity becomes stronger when the desired feature depends on assets and systems
the web client does not already have: authored skeletons, high-quality blending,
3D spatial relationships, cameras, lighting, particles, mocap, or synchronized
animation/audio timelines. The product decision should therefore be framed as:

> Do we need a richer character-animation pipeline, or only richer UI motion?

The web handles the second category well. Unity can justify itself through the
first.

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
experience rather than a card table about dance **and uses a production animation
asset pipeline**. Examples include:

- dancer avatars performing the selected Position, Move, and Flourish;
- animation blending between compatible salsa figures;
- beat- and phrase-synchronized effects;
- a spatial dance floor with camera work;
- reactive music, lighting, particles, and haptics; and
- storefront-quality native presentation.

Those features align with Unity's strengths and can justify its additional
engineering and release overhead. The completed code-drawn dancer sampler did
not show a Unity quality advantage; it showed that UI Toolkit can reproduce the
same articulated silhouette with more imperative lifecycle work. A glowing
draggable card or flat instructional figure by itself does not justify the second
client.

## Decision matrix

| Product priority                   | Better primary approach | Reason                                                                                        |
| ---------------------------------- | ----------------------- | --------------------------------------------------------------------------------------------- |
| Fast rules and balance iteration   | Web                     | One engine and instant delivery shorten the feedback loop.                                    |
| Hot-seat on any available device   | Web                     | No install and an existing responsive layout.                                                 |
| Two-device household multiplayer   | Web                     | The authoritative room architecture already exists.                                           |
| Hidden-hand correctness and replay | Web                     | `PlayerSnapshot` and the action log are already the system boundary.                          |
| Automated cross-device UI coverage | Web                     | Browser automation directly exercises the interaction.                                        |
| macOS-native desktop feel          | Unity                   | Native windowing and a purpose-built application shell.                                       |
| Highly tactile custom card motion  | Unity                   | Full control over input, previews, timing, and effects.                                       |
| Flat instructional silhouettes     | Web                     | CSS/SVG motion is fast to iterate, responsive, accessible, and directly testable.             |
| Rigged or 3D dance instruction     | Unity                   | Animator, Timeline, IK, cameras, and audiovisual synchronization become first-class concerns. |
| Lowest release and update friction | Web                     | A URL replaces native packaging and client update management.                                 |
| One maintainable rules authority   | Web today               | The TypeScript engine already governs web hot-seat and online play.                           |

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
cards representing it—and if flat web instruction is insufficient. At that
point, test Unity with a representative production-quality rig before committing
to the platform, and preserve the browser architecture's best property: one
authoritative rules and action service. Unity should become a rich presentation
client for that service rather than an independent version of the game.

In concise form:

> Build Clave like Board Game Arena until the dance itself demands Hearthstone.

## Suggested next experiments

1. Run the same opening and one complete turn in both clients with the same two
   players; record preference, clarity, speed, and error rate.
2. The code-drawn dancer experiment is complete. Run its Position, Move, and
   Flourish modes with players and record whether the instruction changes
   understanding or preference.
3. Keep a shared action replay fixture and require both engines to produce the
   same legal actions and resulting public state while the C# prototype exists.
4. Measure iteration time for one rules change and one visual change in both
   systems rather than relying only on code volume.
5. If the silhouettes test well but lack clarity, compare one professionally
   rigged or mocap-derived Unity Move against one web SVG/canvas equivalent. This
   is the next experiment capable of testing Unity's actual animation advantage.
6. If Unity continues beyond prototyping, define the action/snapshot network
   protocol before adding more independent C# rules.
