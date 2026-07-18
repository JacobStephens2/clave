# Partner Dance Game — Tech Stack Reference (HISTORICAL / POST-v1)

> **STATUS: SUPERSEDED FOR v1 — NOT AUTHORITATIVE.** Clave v1 is a single
> TypeScript web application; the governing plan is `docs/plans/clave-plan.md`
> (adjudicated 2026-07-18). The five-platform native architecture and Rust core
> described below are a **post-v1 vision**, gated on a native client actually
> being scheduled (plan decision D2). Do not implement anything from this
> document for v1, and do not treat its agent directives (§13) as current.

> **Project umbrella:** *Partner Dance Game* (colloquially "Clave," after the first shipping iteration)
> **First iteration:** *Clave — A Partner Dance Game (Salsa)*
> **Future iterations:** Lindy hop, blues, bachata, and cross-style fusion
> **Purpose of this document:** Historical tech-stack study for the eventual multi-platform series, retained as the post-v1 reference for the Rust-core / native-clients direction.

---

## 1. Project Overview

The *Partner Dance Game* series is a family of cooperative, two-player partner-dance card games built on a single shared engine (`partner-dance-core`). Each iteration in the series ships under its own title and covers a specific dance tradition, with cross-style fusion play planned as a long-term capstone.

**Clave — A Partner Dance Game (Salsa)** is the first iteration and the one driving the architectural choices in this document. The original concept was conceived for two players (the developer and his partner Mel) to play on Android phones over a local connection during flights — that "two phones, one game" use case remains a core design pillar even as the platform scope expanded to a five-platform native architecture.

### Naming and Scope

The project distinguishes between three things:

- **The umbrella project** — *Partner Dance Game* — the overall series and the GitHub repository
- **The shared engine** — `partner-dance-core` — a Rust crate that is dance-style-agnostic and serves every iteration
- **Each shipping iteration** — *Clave* (salsa), and future per-style titles (e.g., a forthcoming lindy iteration would carry its own title)

Dance-style content (cards, position graphs, music metadata, art assets) is loaded into the unified engine as **content packs**, not as separate compilation targets. Cross-style fusion play depends on this — a fusion deck mixes salsa positions, lindy moves, and bachata flourishes in one game session, which only works against a unified rules engine.

### The Architectural Mission Statement

> **Architect and deliver true native applications across the entire Apple, Google, and Microsoft ecosystems, backed by a single memory-safe systems core.**

This sentence drives every technical decision in this document. When a choice arises between *fastest path to ship* and *most genuinely native experience on each platform*, the project chooses the latter. The Rust core makes that ambition feasible by ensuring the rules engine is written exactly once.

### Design Pillars (informing technical decisions)

- **Cooperative, asymmetric-but-balanced roles.** One player is Lead, the other is Follow. Asymmetry reflects real dance roles but is kept light enough that players learn moves rather than wrestle with role-specific complexity. The Lead plays the first card in a dance.
- **Tabletop, not animation.** UIs should feel like a digital tabletop card game, not an animation-heavy video game.
- **Two phones, one game.** Local two-player offline play is a first-class mode (Android Nearby Connections, iOS Multipeer Connectivity) — designed to work on flights with no internet.
- **The core keeps time.** Genre-appropriate music plays during a round, and audio/phrase timing matters — a per-turn time limit simulates the real-time feel of dancing.
- **Curiosity engine.** A position map, codex, and replay viewer help players learn dance vocabulary. The game doubles as a learning tool — players pick up real move names, styles, and transitions as they play.
- **Narrow scope first.** *Clave* (salsa) only at launch. Other iterations layer in later, with some cards shareable across styles via the content-pack system. Cross-style fusion play is the long-term vision.
- **Deterministic rules.** Same input → same output on every platform, every time.
- **Native quality everywhere.** Each platform's client uses that platform's first-party UI framework — no compromises, no webview wrappers as the final form.

### Game Domain Model (for context, not specification)

Three card categories drive the gameplay loop, regardless of dance style:

1. **Position** — the state the dancers are in (in salsa: open, closed, shines/disconnected, promenade, cuddle; in other styles, the position vocabulary differs but the concept is universal)
2. **Move** — transitions and turns (e.g., in salsa: follow outside turn, lead outside turn, inside turn)
3. **Flourish / Flare** — embellishments played on top of a move (e.g., hand twist), often with requirements like "free hand"

The Rust core models these as part of the position graph (Section 2). A round represents a single song (~20–30 cards played, ~10–15 decisions per player). Players score performance points, style points, and earn experience points that fuel a mid-round deck-building loop where new moves are picked up from a shared "lessons" market.

This domain context is included so Claude Code agents understand *what kinds of types and rules* the core is modeling, not as a complete game design specification — see `docs/gdd.md` and `docs/rules-spec.md` for that.

---

## 2. Architectural Principle: Headless Rust Core + Native UIs

The single most important architectural principle:

> **One Rust core (`partner-dance-core`) owns all game rules, state, and protocol types. Every platform builds a native UI in that platform's first-party framework, consuming the core through a thin binding layer. Dance-style differences are content-pack data, not separate engines.**

```
                       ┌────────────────────────────┐
                       │   partner-dance-core (Rust) │
                       │  rules · state · RNG        │
                       │  replay · protocol          │
                       │  + content packs (salsa,    │
                       │  lindy, blues, fusion)      │
                       └──────────┬──────────────────┘
                                  │
        ┌────────┬────────┬───────┼────────┬────────┐
        │        │        │       │        │        │
     UniFFI   UniFFI   UniFFI  wasm-     UniFFI   direct
     Kotlin   Swift    Swift   bindgen    C#       import
        │        │        │       │        │        │
        ▼        ▼        ▼       ▼        ▼        ▼
    Android     iOS     macOS    Web    Windows    Server
   (Compose) (SwiftUI)(SwiftUI)(React)  (WinUI 3)  (Axum)
```

The architectural symmetry is the point: **the same Rust core is consumed through four different binding mechanisms by four genuinely native UI frameworks** (Compose, SwiftUI, React, WinUI 3), plus direct crate import on the server. **Every shipping client is genuinely native to its ecosystem — there are no webview-wrapper interim builds.** This is the architecture that earns the "true native across Apple, Google, and Microsoft" claim with no asterisk.

### What the core OWNS

- Card definitions for all three card types (Position, Move, Flourish)
- **Content-pack loader** — loads dance-style-specific data (salsa cards, lindy cards, etc.) into the engine at runtime
- Deck construction, shared "lessons" market state
- Position graph (dance positions and their legal transitions, parameterized per content pack)
- Move grammar (entry/exit positions, tags, families, "free hand" and other flourish requirements)
- Role model (Lead / Follow asymmetry, Lead-plays-first invariant)
- Game state, turn/phrase/beat state machine, round-as-song length tracking
- Legal action generation
- Rule application, scoring (performance points, style points, experience points)
- Replay/event log
- Deterministic, seedable RNG
- Serialization schemas (JSON via `serde`)
- Network protocol message types
- Player-visible snapshots (asymmetric — Lead and Follow may see different information)
- Educational explanation keys (move names, dance theory tags)
- Cross-style fusion logic (a single game session can mix content packs)
- **Animation hints** (e.g., `VisualEvent::CardMovedToTable { card_id }`) — the core describes *what happened*; the UI decides *how to animate it*

### What the core does NOT own

- SwiftUI / Compose / React / XAML concepts
- Touch gestures, click handling, keyboard input
- DOM manipulation, Web Audio API
- Android Nearby Connections / iOS Multipeer Connectivity (transport-specific code lives in the platform layer)
- Animations as implementation
- UI layout (joint dance state on top, hand at bottom, follow market in view — these are platform-UI concerns)
- Card artwork (Afro-Caribbean Figurative Expressionist style for *Clave*; per-style art directions for future iterations) — assets live outside the core
- Platform navigation, file pickers, permissions
- Audio playback (the core may emit beat/phrase timing events; the UI plays the audio, including any Suno-generated soundtrack)
- Per-turn timer enforcement (the UI runs the wall-clock timer; the core only knows about turn state and accepts timeout actions when the UI sends them)

---

## 3. Why Rust for the Core

Rust was chosen after evaluation against C++, Kotlin Multiplatform, C#/.NET, and TypeScript. It wins on this specific platform combination because:

1. **It compiles natively to all target platforms** (`aarch64-apple-ios`, `aarch64-linux-android`, `x86_64-pc-windows-msvc`, `wasm32-unknown-unknown`, `aarch64-apple-darwin`, etc.)
2. **No garbage collector** → tiny WASM payloads on the web (vs. 5–10× larger for .NET Blazor or Kotlin/Wasm)
3. **Mature FFI tooling** — UniFFI for Swift/Kotlin/C#, `wasm-bindgen` for TypeScript
4. **The borrow checker is an AI safety net.** AI-generated Rust that compiles is dramatically more trustworthy than AI-generated C++ or TypeScript that "compiles."
5. **Determinism.** No GC pauses, no hidden allocations in hot paths, identical behavior across platforms.
6. **Server reuse.** The same crate runs on the authoritative multiplayer server with zero binding overhead — the server validates every client action with the exact same code that produced it.

This pattern is used in production by 1Password, Discord, Figma, Cloudflare Workers, Mozilla Firefox, and WalletConnect.

---

## 4. The Full Platform Stack

| Platform | UI Framework | Language | Core Access | Distribution | Status |
|----------|-------------|----------|-------------|-------------|--------|
| **Web** | React + TypeScript + Vite | TypeScript | `wasm-bindgen` → Rust WASM | URL / PWA | Definitive (built first) |
| **Android** | Jetpack Compose | Kotlin | UniFFI Kotlin → Rust `.so` | Google Play | Definitive |
| **iOS** | SwiftUI | Swift | UniFFI Swift → Rust XCFramework | App Store | Definitive |
| **macOS** | SwiftUI (shared with iOS) | Swift | UniFFI Swift → Rust XCFramework | Mac App Store / notarized DMG | Definitive |
| **Windows** | WinUI 3 (Windows App SDK) | C# / .NET | UniFFI C# (`uniffi-bindgen-cs`) → Rust DLL | MSIX / Microsoft Store / Steam | Definitive |
| **Server** | Axum (HTTP/WebSocket) | Rust | Direct Rust crate import (no FFI) | Cloud (Linux containers) | Definitive |

> **There is no Tauri build, no Electron build, no webview wrapper.** Each platform receives a native-quality client built in that platform's first-party framework. See Section 6.5 for the rationale on why Windows in particular was held to this standard rather than shipped as a wrapped web app.

### Multiplayer Modes by Platform

| Mode | Web | Android | iOS | macOS | Windows |
|------|-----|---------|-----|-------|---------|
| Single-player (vs. AI) | ✓ | ✓ | ✓ | ✓ | ✓ |
| Online (server-mediated) | ✓ | ✓ | ✓ | ✓ | ✓ |
| Local offline P2P | ✗ (browser limitation) | ✓ Nearby Connections | ✓ Multipeer Connectivity | ✓ Multipeer Connectivity | — |
| Same-device hot-seat | ✓ | ✓ | ✓ | ✓ | ✓ |

The "two phones on a flight" use case requires the Android (Nearby Connections) or iOS (Multipeer Connectivity) native clients. The web client cannot do offline peer discovery and falls back to online play through the server.

---

## 5. Repository Layout

```
partner-dance-game/
├── core/                          # The Rust game core — single source of truth
│   ├── Cargo.toml                 # crate name: partner-dance-core
│   └── src/
│       ├── lib.rs
│       ├── cards.rs               # Position, Move, Flourish card definitions
│       ├── content_pack.rs        # Content-pack loader for per-dance-style data
│       ├── positions.rs           # Position graph (parameterized by content pack)
│       ├── actions.rs             # GameAction enum, legality
│       ├── game_state.rs          # GameState, reducer, Lead/Follow roles
│       ├── scoring.rs             # Performance, style, experience points
│       ├── market.rs              # Shared lessons market for mid-round deck-building
│       ├── replay.rs              # Event log
│       ├── rng.rs                 # Deterministic, seedable
│       ├── snapshots.rs           # PlayerSnapshot for UIs (asymmetric per role)
│       ├── fusion.rs              # Cross-style fusion logic
│       └── protocol.rs            # Network message types
│
├── content/                       # Dance-style content packs (data, not code)
│   ├── salsa/
│   │   ├── cards.json             # Salsa Position/Move/Flourish definitions
│   │   ├── positions.json         # Salsa position graph
│   │   └── manifest.toml
│   ├── lindy/                     # (future)
│   ├── blues/                     # (future)
│   ├── bachata/                   # (future)
│   └── fusion/                    # (future) — references multiple packs
│
├── bindings/
│   ├── uniffi/                    # Swift, Kotlin, C# bindings
│   │   ├── Cargo.toml
│   │   ├── src/lib.rs
│   │   └── partner_dance.udl      # UniFFI interface definition (source for Swift, Kotlin, C#)
│   │
│   └── wasm/                      # wasm-bindgen exports for the web
│       ├── Cargo.toml
│       └── src/lib.rs             # #[wasm_bindgen] annotations
│
├── apps/
│   ├── clave-web/                 # React + TypeScript + Vite (BUILT FIRST)
│   │   ├── package.json           # Loads salsa content pack
│   │   ├── vite.config.ts         # vite-plugin-wasm + top-level-await
│   │   └── src/
│   │
│   ├── clave-android/             # Kotlin + Jetpack Compose
│   │   └── (Gradle project)
│   │
│   ├── clave-apple/               # Swift + SwiftUI (iOS + macOS shared)
│   │   ├── ClaveShared/           # SwiftUI views shared between iOS and macOS
│   │   ├── ClaveiOS/
│   │   └── ClaveMac/
│   │
│   └── clave-windows/             # WinUI 3 + C# (the definitive Windows client)
│       ├── ClaveWindows.sln
│       ├── ClaveWindows/          # WinUI 3 + C# project
│       │   ├── App.xaml
│       │   ├── MainWindow.xaml
│       │   ├── Views/             # XAML views
│       │   ├── ViewModels/        # MVVM view models
│       │   └── Bindings/          # Generated C# bindings from uniffi-bindgen-cs
│       └── Package.appxmanifest   # MSIX packaging metadata
│
├── server/                        # Authoritative multiplayer server
│   ├── Cargo.toml                 # Imports partner-dance-core as a regular dependency
│   └── src/
│       └── main.rs                # Axum HTTP + WebSocket
│
├── assets/                        # Card artwork, music, fonts (per-iteration subdirs)
│   ├── clave-salsa/               # Afro-Caribbean Figurative Expressionist art
│   └── ...
│
└── docs/                          # Game design and pre-production documents
    ├── gdd.md                     # Game Design Document
    ├── rules-spec.md              # Rules, edge cases, keyword glossary
    ├── card-list.md               # Master card spreadsheet
    ├── ux-flow.md                 # UI flows
    └── tdd.md                     # Technical Design Document (this doc is a section of it)
```

The `apps/` subdirectories are prefixed by iteration (`clave-*`) because each shipping iteration may evolve its own UI nuances. Future iterations would live alongside as `apps/[lindy-title]-android/`, etc., all pointing at the same `partner-dance-core` crate.

---

## 6. Per-Platform Details

### 6.1 Web (Built First)

The web client is the **first platform to be implemented**, ahead of all native clients. See Section 12 for the full sequencing rationale; the short version is that device-whitelisting constraints on the developer's personal Android, iPhone, MacBook, and Windows laptop make browser-based iteration the only friction-free development loop available.

- **Language:** TypeScript (strict mode)
- **UI framework:** React 19
- **Build/dev tooling:** Vite with `vite-plugin-wasm` and `vite-plugin-top-level-await`
- **Core access:** Rust compiled to `wasm32-unknown-unknown` via `wasm-pack build --target web`; bindings generated by `wasm-bindgen`; complex types crossed via `serde-wasm-bindgen`
- **Styling:** Tailwind CSS
- **Animation:** Framer Motion (for card transitions and table animations — kept restrained per the "tabletop, not animation" pillar)
- **Routing:** TanStack Router (type-safe)
- **Client state:** Zustand (or TanStack Query for server state)
- **Audio:** Web Audio API for phrase-accurate scheduling of the genre soundtrack
- **Offline:** Service worker + Workbox for PWA support (single-player and AI play work fully offline)
- **Distribution:** Static deploy (Vercel / Netlify / Cloudflare Pages); installable as a PWA

> Because the web PWA is fully featured (online multiplayer + offline single-player + AI play), it serves all playtesting needs across every operating system, including Windows. There is no need for an interim desktop wrapper.

#### Why web-first is also the right *engineering* choice

Beyond the practical iteration-velocity argument, the `wasm-bindgen` + TypeScript path is in some ways the *most demanding* of the four FFI mechanisms:

- TypeScript types must be derived from Rust types via `serde-wasm-bindgen`, which exposes any awkwardness in your serialization design immediately
- The async story between Rust futures and JavaScript promises is more nuanced than UniFFI's blocking calls
- Bundle size matters in a way it doesn't for native apps, forcing discipline about what crosses the boundary
- The dev loop is fast enough that every API design mistake is felt within seconds

If `partner-dance-core`'s API design works cleanly through `wasm-bindgen`, it will almost certainly work cleanly through UniFFI's Swift/Kotlin/C# generators too. The reverse is less reliably true. Building web first lets the toughest binding path shape the API surface, and the easier paths inherit that discipline for free.

### 6.2 Android

- **Language:** Kotlin (latest stable)
- **UI:** Jetpack Compose with Material 3
- **Build:** Gradle with Kotlin DSL
- **Core access:** UniFFI-generated Kotlin bindings; Rust compiled to `.so` for `arm64-v8a`, `armeabi-v7a`, `x86_64`
- **Local multiplayer:** Google Nearby Connections API — this is the platform that delivers the original "two phones on a flight" use case
- **Online multiplayer:** OkHttp WebSocket client → Rust server
- **State management:** Compose state + ViewModel; treat Rust `PlayerSnapshot` as the source of truth for game state
- **Distribution:** Google Play Store

### 6.3 iOS

- **Language:** Swift (latest stable)
- **UI:** SwiftUI
- **Build:** Xcode with Swift Package Manager
- **Core access:** UniFFI-generated Swift bindings packaged as an XCFramework (covers `aarch64-apple-ios`, `aarch64-apple-ios-sim`, `x86_64-apple-ios`)
- **Local multiplayer:** Multipeer Connectivity framework
- **Online multiplayer:** `URLSessionWebSocketTask` → Rust server
- **State management:** `@Observable` / `@State` with Rust snapshots as the source of truth
- **Distribution:** Apple App Store

### 6.4 macOS

- **Language:** Swift
- **UI:** SwiftUI (large fraction of views shared with iOS via `ClaveShared` package; platform-specific modifiers via `#if os(macOS)`)
- **Build:** Xcode; same XCFramework as iOS extended with `aarch64-apple-darwin` and `x86_64-apple-darwin`
- **Desktop adaptations:** `WindowGroup`, `CommandMenu`, `.keyboardShortcut`, `.onHover`
- **Distribution:** Mac App Store and/or notarized DMG outside the store

### 6.5 Windows (WinUI 3 + C#)

The Windows client is genuinely native. There is no Tauri or Electron interim build. The deployed web PWA already covers playtesting on Windows for any user who wants to play before the WinUI client ships, so a webview-wrapper desktop build would only add maintenance overhead without delivering anything the PWA does not.

- **UI framework:** WinUI 3 (Windows App SDK)
- **Language:** C# / .NET 9+ with NativeAOT where appropriate
- **UI definition:** XAML with MVVM pattern
- **Design language:** Fluent Design System (Mica materials, acrylic, accent colors, system theming)
- **Core access:** UniFFI-generated C# bindings via `uniffi-bindgen-cs` (NordSecurity), against the same `partner_dance.udl` used for Swift and Kotlin
- **Fallback binding option:** `csbindgen` + manual P/Invoke if `uniffi-bindgen-cs` proves problematic (validated up front by the Phase 2.5 binding spike — see Section 12)
- **Build targets:** `x86_64-pc-windows-msvc` and `aarch64-pc-windows-msvc` (Rust DLL); `win-x64` and `win-arm64` (.NET)
- **Build/dev tooling:** Visual Studio 2026 with Windows App SDK workload
- **Distribution:** MSIX packaging via Microsoft Store, Steam, and direct download
- **Code signing:** Authenticode certificate ($300–$500/year budget)

#### Why Windows gets a fully native client (and not a wrapped web app)

The decision to build a true native WinUI 3 client rather than a webview-wrapper is intentional. WinUI gives the Windows iteration access to capabilities that are either impossible, unstable, or visibly degraded under a webview model — capabilities that compromise the "true native across the Microsoft ecosystem" mission if surrendered. A wrapped web app would have meant settling for a Windows version that *runs* on Windows rather than one that *belongs* on Windows.

**Visual fidelity and platform integration**
- **Fluent Design materials** (Mica window backdrops, Acrylic blur layers, system tint accent) that automatically respect Windows 11's per-monitor wallpaper tinting. WebView2 can simulate these in CSS but will not match system behavior pixel-perfectly.
- **Native title bar customization** with system caption buttons that respect Windows accent color, theme changes, and high-contrast modes natively.
- **Per-monitor DPI awareness with native scaling.** WebView2 handles DPI but with subtle pixel-snapping artifacts that XAML-rendered content does not exhibit.
- **System-rendered native controls** (`ComboBox`, `DatePicker`, `MenuFlyout`) that match every other Windows app exactly, including animation timing and accessibility behavior.
- **Reveal highlight, connected animations, and theme transitions** built into XAML — these are the Windows 11 "feel" cues that immediately distinguish a native app from a wrapped web app.

**Animation and rendering performance**
- **Composition API access** (the same engine that powers the Windows shell itself) for GPU-accelerated card animations with frame-perfect timing.
- **DirectX/Win2D interop** for any custom drawing — phrase-beat visualizations, position graph rendering, or replay timeline scrubbers — without a webview compositor's overhead.
- **Lower input latency** for touch and pen — XAML's input pipeline is several frames faster than WebView2's, which matters on touch-screen Windows laptops and Surface devices.

**System integration features**
- **Jump Lists** on the taskbar (right-click the icon to resume last game, start new game, open replay).
- **Live tiles / badges** (still supported in MSIX) showing pending invitations or unread challenges.
- **Toast notifications via `ToastNotificationManager`** with native action buttons, inline reply, and persistent history in Action Center.
- **`ShareTarget` registration** so users can share replays to the app from any Windows app via the system share sheet.
- **File type associations** (`.clave-replay` files open the app directly with native shell integration, thumbnail previews, and right-click "Open with" context).
- **`StartupTask`** so the app can launch on login for tournament practice schedules.
- **Picker contracts** (`FileOpenPicker`, `FolderPicker`) with native UI rather than browser file dialogs.
- **Game Bar / Xbox Game Bar widget integration** if the iteration is published as a "game" on the Microsoft Store.

**Input and accessibility**
- **Full keyboard accelerator system** with `KeyboardAccelerator` and access keys (Alt-key navigation) — the canonical Windows expectation for serious desktop apps.
- **Gamepad navigation** out of the box (relevant if the game ships on Steam Deck or with Xbox controller support).
- **UI Automation provider** with deep semantic information for screen readers (Narrator, NVDA, JAWS) — a webview wrapper inherits the WebView's accessibility tree, which is good but not as platform-idiomatic.
- **Pen and ink input** with handwriting recognition, useful for note-taking on dance vocabulary in the codex view.

**Distribution and trust**
- **Microsoft Store certification** with full Store badges, ratings, and discoverability.
- **MSIX packaging** with clean install/uninstall, automatic updates, and per-user vs. per-machine installation modes.
- **Smaller installer trust footprint** — no WebView2 runtime dependency to install or update separately.
- **Enterprise deployment** via Intune, SCCM, and Group Policy — relevant for the salsa-school-installs-the-app-on-classroom-PCs use case.

**Performance characteristics**
- **Lower memory footprint** in steady state (no Chromium tab process; XAML's UI thread + render thread are lighter than WebView2's process tree).
- **Faster cold start** — WinUI 3 launches in tens of milliseconds; WebView2 has to initialize a Chromium subprocess.
- **AOT compilation** via .NET NativeAOT means the app is a pure native binary at runtime, not JIT-compiled IL.

**Forward-compatible Microsoft features**
- **Windows AI APIs** (Copilot+ PC features, on-device language models) for explanation generation or move suggestion in the codex view.
- **Windows ML** for any future ML-driven features (move recognition, dance pattern analysis from video).
- **ARM64 native execution** with first-class support, not webview-emulated.

The honest summary: **a wrapped web app could ship a functional Windows version, but WinUI 3 ships a Windows version that feels like it belongs on Windows.** For a project whose mission is "true native across Apple, Google, and Microsoft," the webview shortcut was rejected.

### 6.6 Server

- **Language:** Rust
- **Web framework:** Axum (HTTP routes + WebSocket upgrades)
- **Async runtime:** Tokio
- **Core access:** `use partner_dance_core::*;` — direct Cargo dependency, zero FFI overhead
- **Role:** Authoritative game state validation, matchmaking, persistence, online multiplayer transport
- **Why Rust here too:** The server runs the *same rules code* as every client. Clients cannot lie about whether a move was legal, because the server re-runs `apply_action` and rejects illegal claims.

---

## 7. The FFI Boundary: API Design Rules

The FFI boundary (UniFFI for native, `wasm-bindgen` for web) is the most architecturally sensitive part of the system. Cross-language calls have overhead, and complex types must serialize. Follow these rules:

### Keep the API coarse-grained

The UI calls the core at meaningful semantic boundaries (one call per user action), not for tiny field-level reads.

**Good:**
```rust
pub fn apply_action(state: GameState, action: GameAction) -> Result<GameState, RuleError>;
pub fn snapshot_for_player(state: &GameState, player: PlayerId) -> PlayerSnapshot;
pub fn legal_actions(state: &GameState, player: PlayerId) -> Vec<GameAction>;
pub fn serialize_replay(log: &ReplayLog) -> String;
pub fn load_content_pack(pack: ContentPackData) -> Result<ContentPack, LoadError>;
```

**Bad:**
```rust
pub fn get_card_name(state: &GameState, card_id: u32) -> String;     // too granular
pub fn get_score(state: &GameState, player: PlayerId) -> i32;        // too granular
pub fn get_current_position(state: &GameState) -> PositionId;        // too granular
```

### Pass whole snapshots, not individual fields

The UI receives a `PlayerSnapshot` for the current player and renders from it. The snapshot contains everything the UI needs for one frame, *and respects role asymmetry* — Lead and Follow may legitimately see different information.

```rust
pub struct PlayerSnapshot {
    pub phrase: u32,
    pub role: Role,                    // Lead | Follow
    pub hand: Vec<CardView>,           // size differs by role
    pub position: PositionView,        // current joint dance position
    pub last_move: Option<MoveView>,
    pub active_flourish: Option<FlourishView>,
    pub legal_actions: Vec<GameAction>,
    pub last_outcome: Option<PhraseOutcome>,
    pub score: ScoreSummary,           // performance, style, experience
    pub market: MarketView,            // shared lessons available to pick up
    pub animation_hints: Vec<VisualEvent>,
}
```

### One UDL file feeds three languages

A single `bindings/uniffi/partner_dance.udl` file is the source of truth for Swift, Kotlin, **and C#** bindings. UniFFI generates language-appropriate wrappers from this one definition. This means a change to the Rust API surface propagates to all three languages with one edit.

### Generated namespace conventions

The UniFFI bindings will produce these namespaces in their respective languages:

- **Swift module:** `PartnerDance`
- **Kotlin package:** `partnerdance` (or `com.partnerdance`)
- **C# namespace:** `PartnerDance`

UI code in each native client wraps these in iteration-specific modules (`Clave.*`) where the iteration's branding belongs.

### Use `serde` for everything that crosses the boundary

All types exposed across FFI should derive `serde::Serialize` and `serde::Deserialize`. UniFFI handles this for native; `serde-wasm-bindgen` handles it for the web.

### The web-first API discipline benefit

Because the web client is built first (see Section 12), the `wasm-bindgen` boundary is the first place these rules get exercised in practice. Treat any awkwardness in the WASM interop as a signal that the Rust API itself needs refinement *before* the same shape gets locked into Swift, Kotlin, and C# bindings downstream.

---

## 8. Determinism Requirements

Because the core runs on five clients and a server, all of which must agree on outcomes, determinism is a hard requirement, not a nice-to-have:

- **RNG must be seedable and pure.** Use `rand::SeedableRng` with an explicit seed; never use system/thread RNG inside core logic. The seed should be part of the game's initial state so replays reconstruct identically.
- **No floating-point in scoring or rules.** Use integers or fixed-point. Floats vary subtly across architectures.
- **No `HashMap` iteration order in serialized output.** Use `BTreeMap` or sort before serializing.
- **No system time inside the core.** Time-relevant inputs (per-turn timeouts, song-length tracking) must be passed in explicitly. The UI runs the wall-clock timer; the core only knows about turn state.
- **Replays must reconstruct identical final state.** Add a property test for this.
- **Content pack loading must be deterministic.** Two clients loading the same `salsa` content pack must produce identical `ContentPack` instances down to byte-level serialization.

---

## 9. Testing Strategy

Tests live where they're cheapest and fastest:

- **Rust unit tests** in `core/src/**/*.rs` — exhaustive coverage of rules, scoring, position transitions (open ↔ closed, etc.), flourish requirements, replay reconstruction, content-pack loading. These run in milliseconds and should be the primary safety net.
- **Property tests** (via `proptest`) — fuzz the reducer with random action sequences, assert invariants (no negative scores, no illegal positions reachable, replays round-trip, Lead-plays-first invariant always holds).
- **Snapshot tests** — capture `PlayerSnapshot` JSON for canonical scenarios and detect regressions.
- **Two-tab web playtesting** — open the deployed web client in two browser tabs against a localhost (or staging) Axum server to validate the full multiplayer protocol without needing any native build. One tab plays Lead, the other plays Follow.
- **UI tests** per platform — minimal smoke tests; the heavy correctness work happens in Rust.
- **End-to-end tests on web** via Playwright — validates the WASM loading path and full user flows.
- **WinUI UI tests** via WinAppDriver / Appium for critical Windows flows once the WinUI client is in active development.

---

## 10. Build & CI Targets

Per-platform Rust build commands:

```bash
# Web (built first)
wasm-pack build bindings/wasm --target web --release

# iOS (and simulator)
cargo build --release --target aarch64-apple-ios
cargo build --release --target aarch64-apple-ios-sim
cargo build --release --target x86_64-apple-ios

# macOS
cargo build --release --target aarch64-apple-darwin
cargo build --release --target x86_64-apple-darwin

# Android
cargo build --release --target aarch64-linux-android
cargo build --release --target armv7-linux-androideabi
cargo build --release --target x86_64-linux-android

# Windows (DLL for WinUI consumption)
cargo build --release --target x86_64-pc-windows-msvc
cargo build --release --target aarch64-pc-windows-msvc

# Generate C# bindings (after Rust DLL is built)
uniffi-bindgen-cs bindings/uniffi/partner_dance.udl --out-dir apps/clave-windows/ClaveWindows/Bindings
```

CI should build all targets on every PR to `main` and run the full Rust test suite. Platform UI builds can be gated to their own branches/runners. The WinUI build requires a Windows runner with Visual Studio 2026 and the Windows App SDK installed.

---

## 11. Tooling Conventions

- **Rust:** `cargo fmt`, `cargo clippy --all-targets -- -D warnings`, `cargo test`
- **Swift:** Xcode default formatter; SwiftLint
- **Kotlin:** `ktlint`; Android Studio default formatter
- **TypeScript:** Prettier + ESLint; strict TypeScript (`"strict": true`)
- **C#:** `dotnet format`; .editorconfig with Microsoft's recommended C# style; nullable reference types enabled
- **Commit hygiene:** Conventional Commits format (`feat:`, `fix:`, `refactor:`, etc.)
- **AI-assisted development:** Claude Code Max 20x Opus 4.7 is the primary implementation tool; Perplexity Max is the primary research tool.

---

## 12. Build Order and Sequencing

The recommended platform delivery order is **web-first**, ahead of all native clients. This is a deliberate choice driven by both practical and engineering considerations.

### Why web-first

The developer's personal devices (Android phone, iPhone, MacBook, Windows laptop) all operate under password-controlled app whitelisting managed by another household member. Installing a new `.apk`, `.ipa`, signed `.app`, or `.exe` requires asking permission for each new build, which would create significant iteration friction at exactly the wrong stage of development — when the Rust core's API surface is still being shaped.

The web client is the only deployment path that bypasses this constraint entirely:

- **Zero installation friction.** Refresh a browser tab; the new build is loaded.
- **Zero permission asks.** No gatekeeper involvement in the iteration loop.
- **Zero playtester onboarding cost.** Friends play via a URL — no sideloading instructions, no provisioning profiles, no MSIX certificate trust prompts.

The deployed PWA also covers any "playtesting on Windows before the WinUI client exists" need, which is why no Tauri interim build is required.

There is also a technical upside: as noted in Section 6.1, the `wasm-bindgen` path is the most demanding of the four FFI mechanisms. Building the web client first lets it shape the Rust API surface, and the easier UniFFI bindings (Swift, Kotlin, C#) inherit that discipline for free.

### Phase plan

| Phase | Deliverable | Why This Position |
|-------|------------|-------------------|
| **1** | Rust core spike (`partner-dance-core`) — `apply_action` + `snapshot_for_player` + tests against a salsa content pack | Zero installation friction (runs as `cargo test`) |
| **2** | **Web client (React + Vite + WASM)** — single-player game loop, hot-swap card data, full Lead/Follow round | Zero installation friction; iterate in the browser |
| **2.5** | **WinUI binding spike** (1 day) — build `partner-dance-core` as a Windows DLL, run `uniffi-bindgen-cs`, call `apply_action()` from a blank WinUI app | De-risk the WinUI path early; runs entirely on the developer's Windows laptop with Visual Studio (a dev tool, not a whitelisted app). With no Tauri fallback, this spike is the only Windows risk-reduction step before the full WinUI build. |
| **3** | Online multiplayer server (Axum) | Validate cross-client play; web client can connect to localhost |
| **4** | **Web playtesting deployment** — push to Vercel/Netlify so playtesters can join via URL | No app installs required for *anyone*; friends play via a link; serves as the de facto Windows-and-everywhere playtesting client |
| **5** | Android client (Compose) — UniFFI Kotlin, **Nearby Connections for the original two-phones-on-a-flight use case** | First mobile platform; one whitelisting ask per new build cycle, but the rules engine is already proven on web |
| **6** | iOS client (SwiftUI) — UniFFI Swift, online play, Multipeer Connectivity for local P2P | Mobile parity |
| **7** | macOS client — extends iOS SwiftUI codebase | Near-free after iOS |
| **8** | **Windows client (WinUI 3 + C#)** — the capstone native experience | Full Microsoft-ecosystem native experience; ships when ready, no interim build holding the slot |

### What the web-first sequence proves before any native build

By the end of Phase 4, the following is fully validated *without ever installing a native app*:

- The Rust rules engine is correct (Phase 1 tests + property tests)
- The salsa content pack, position graph, and scoring rules play well in practice (Phase 2)
- The WASM binding mechanism works end-to-end (Phase 2)
- The C# binding path works on the developer's Windows laptop (Phase 2.5)
- The authoritative server validates moves correctly (Phase 3)
- The full online multiplayer protocol works between two clients with asymmetric Lead/Follow roles (Phase 4 — two browser tabs, two players, one server)
- Playtesters on every operating system can play and give feedback at scale (Phase 4 deployment)

When Phase 5 (Android) eventually begins, the native work focuses purely on the platform-specific transport (Nearby Connections) and the Compose UI — not on the rules engine, not on networking protocol design, not on serialization. Every native build inherits a battle-tested core.

### What native mobile uniquely adds (and why it still matters)

Web-first does not diminish the native mobile clients. The "two phones, one game" design pillar — the original concept, born of wanting to play with Mel on flights — fundamentally requires offline P2P play via Nearby Connections (Android) and Multipeer Connectivity (iOS). The web cannot do offline peer discovery; it requires the server. So the native mobile clients aren't optional or deferred — they're how this game delivers its differentiating airplane-and-park-bench play mode and fulfills the use case that motivated the project. Web-first just defers them until the rules engine is solid.

### Why no Tauri (decision record)

An earlier draft of this plan included a Tauri interim Windows build between Phase 4 (web deployment) and Phase 8 (WinUI). It was removed because:

- The deployed web PWA already covers all playtesting needs across every operating system, including Windows, with no installation required
- The "offline on the developer's Windows laptop" use case is rare; the offline priority is the two-phones flights scenario, served by native mobile
- Maintaining a webview-wrapper Windows build alongside an evolving Rust core, web client, and four other native clients during the year-plus middle phase added meaningful overhead with little payoff
- The architectural mission ("true native across Apple, Google, and Microsoft") is cleaner when every shipping client is genuinely native, with no asterisk
- Removing the Tauri safety net ensures the WinUI work actually happens rather than being indefinitely deferred behind a "good-enough" wrapper

The Phase 2.5 binding spike compensates for the lost Tauri-as-Rust-on-Windows-validator role by directly exercising the `uniffi-bindgen-cs` path on the developer's Windows laptop early in the timeline.

---

## 13. What Claude Code Should Do When in Doubt

- **Default to placing logic in the Rust core**, not in any UI. Rules, state transitions, validation, scoring, serialization → Rust.
- **Default to platform-native UI patterns** in each platform's UI layer. Use SwiftUI idioms in SwiftUI, Compose idioms in Compose, React idioms in React, **XAML/MVVM idioms in WinUI**. Do not try to share UI code across native platforms.
- **Default to coarse-grained FFI APIs.** If you're tempted to add a one-line getter that crosses the boundary, instead extend `PlayerSnapshot`.
- **Default to serde-serializable types** for anything that crosses FFI.
- **Default to deterministic, seedable, time-independent code** in the core.
- **Default to writing the Rust test first** when implementing or changing rules.
- **Default to validating new core APIs through the web client first** during Phases 1–4. If a new API feels awkward to call from TypeScript, it will likely feel awkward from Swift/Kotlin/C# too — refine the API now rather than after three native bindings have ossified around it.
- **Default to respecting the asymmetric Lead/Follow role model.** A `PlayerSnapshot` for Lead may legitimately differ from one for Follow (different hand sizes, possibly different visibility into the partner's choices). Don't collapse the asymmetry into a single shared snapshot for convenience.
- **Default to dance-style-agnostic core code.** When implementing a feature in `partner-dance-core`, ask whether the same code would work for lindy hop, blues, and bachata. Style-specific data belongs in content packs (`content/salsa/*.json`), not in core source files. The core should not contain the strings "salsa", "lindy", "blues", or "bachata" except in tests.
- **Default to Fluent Design idioms in WinUI** — use `Mica`/`Acrylic` backdrops, system theme resources, and built-in animation primitives rather than custom CSS-style approximations.
- **Default to MVVM in the WinUI client** — XAML views, view models that wrap C# bindings to the Rust core, observable properties for reactive UI updates.
- **Default to "tabletop, not animation"** when designing UI feedback. Card animations should be restrained and meaningful — this is a thoughtful card game, not an action title.
- **Never put UI, audio, networking transport, card artwork, or platform-specific code in `partner-dance-core`.** That crate must remain headless.
- **Never propose adding a Tauri or Electron build to fill a gap.** The project explicitly rejected webview-wrapper desktop builds. If a gap exists, the answer is either improving the web PWA (for cross-OS reach) or accelerating the WinUI client (for native Windows quality).
- **When adding a Rust API that crosses the FFI boundary, update `partner_dance.udl` once and regenerate Swift, Kotlin, and C# bindings together.** Drift between the three is the most likely source of integration bugs.
- **When in doubt about game design specifics**, defer to `docs/gdd.md` and `docs/rules-spec.md` rather than guessing — this technical document intentionally underspecifies game design so the design documents remain the source of truth there.

---

## 14. The Mission Restated

Every architectural decision in this document serves one goal:

> **Architect and deliver true native applications across the entire Apple, Google, and Microsoft ecosystems, backed by a single memory-safe systems core.**

When making implementation choices, ask: *Does this advance that mission, or compromise it?*

Two structural choices express this mission most clearly:

1. **Every shipping client is genuinely native to its ecosystem.** Compose for Android, SwiftUI for Apple, React-as-a-PWA for the web (the web's native paradigm), WinUI 3 + C# for Microsoft. There is no Tauri, no Electron, no webview wrapper masquerading as a desktop app. The mission statement carries no asterisk.

2. **The core is dance-style-agnostic.** Naming the engine `partner-dance-core` rather than `clave-core` reflects its true scope: it serves *Clave* (salsa) first, but it is engineered to serve a series of partner-dance card games — lindy hop, blues, bachata, and cross-style fusion — all loading their content as packs against the same compiled engine.

The web-first build order is the third clearest expression: it acknowledges that *real-world iteration constraints* (device whitelisting) shape what "shipping iteratively" means in practice, without compromising the end-state architecture. The web client is both the first thing built and a permanent definitive platform — not a throwaway prototype.

The end state is an architecture in which Compose feels like a Compose app, SwiftUI feels like an Apple app, WinUI 3 feels like a Microsoft app, the web feels like a modern PWA, and **all five run identical game logic compiled from the same Rust source file** — a partner dance card game where two dancers, Lead and Follow, build a song together one card at a time, learning real moves as they play. *Clave* is the first iteration; the architecture is built for many.

---

*Last updated: 2026-05-17*
