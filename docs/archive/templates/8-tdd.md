# Technical Design Document

## 1. Stack (to be decided)
- Engine/framework: <TBD — candidates: Unity, Godot, Unreal, native Android (Kotlin/Compose),
  Flutter/Flame, web + wrapper, LibGDX, Defold, custom, etc.>
- Language: <TBD>
- Build system:
- CI:

## 2. Stack Evaluation Criteria
- Learning goals (what do I want to experiment with?)
- Card/UI rendering strength
- Mobile touch input ergonomics
- Android distribution story (APK/AAB, Play Console)
- Data-driven content support
- Community/ecosystem + tooling
- Performance on mid-range Android devices

## 3. Architecture
- Scene/screen structure: Boot, Main Menu, Deckbuilder, Match, Results
- State management approach
- Data layer: content loaded at boot, validated against schema

## 4. Effect Resolution Engine
- Model: <stack / queue / sequential>
- Deterministic RNG seed per match
- Replay log format

## 5. Persistence
- Local storage approach
- Save schema version + migration strategy

## 6. External Libraries
- <lib>: purpose, license

## 7. Performance Budgets
- Target: 60 fps on <baseline device>
- Memory ceiling:
- Draw call / render budget:

## 8. Code Organization
- Folder layout conventions
- Branching: trunk-based / GitFlow

## 9. Android Delivery
- Packaging (AAB/APK)
- Permissions / manifest
- Signing & release pipeline

## 10. Risks
- <Risk> — mitigation
