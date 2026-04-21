<img src="https://r2cdn.perplexity.ai/pplx-full-logo-primary-dark%402x.png" style="height:64px;margin-right:32px"/>

### 1. Where Models Agree

| Finding | GPT-5.4 Thinking | Claude Opus 4.7 Thinking | Gemini 3.1 Pro Thinking | Evidence |
| :-- | :-- | :-- | :-- | :-- |
| Write a GDD (can be “lite”) to lock vision/scope/core loop | ✓ | ✓ | ✓ | GDD as shared source of truth for vision, systems, audience; keep it lightweight/living.[^1_1][^1_2] |
| Create a rigorous rules + edge-case/keyword spec (resolution order, zones, phases) | ✓ | ✓ | ✓ | Card games need unambiguous rules; edge-case resolution order prevents bug cascades.[^1_1][^1_3] |
| Maintain a master card database (spreadsheet/CSV) with a clear card schema | ✓ | ✓ | ✓ | Spreadsheets organize/balance/share card data; can export/import to pipelines.[^1_4][^1_5] |
| Produce UX flow/storyboard/wireframes for mobile screens and flows | ✓ | ✓ | ✓ | Storyboard of app flow is foundational; forces thinking through screens/interactions.[^1_3] |
| Draft a Technical Design Document (architecture, state/resolution engine, platform constraints) | ✓ | ✓ | ✓ | TDD outlines implementation blueprint: risks, architecture, org, performance, platform reqs.[^1_6] |
| Plan analytics/launch basics early (event taxonomy, soft launch/ASO checklist) | ✓ | ✓ |  | Mobile launch success benefits from early analytics and soft-launch planning.[^1_7][^1_8] |

### 2. Where Models Disagree

| Topic | GPT-5.4 Thinking | Claude Opus 4.7 Thinking | Gemini 3.1 Pro Thinking | Why They Differ |
| :-- | :-- | :-- | :-- | :-- |
| “Must-have” count vs. lean starter set | 10-doc set; also offers lean 7-doc subset | Start with 3 core docs, expand in tiers | Focus on “sources of truth” for solo dev | Different assumptions about bandwidth: comprehensive production readiness vs. fastest path to coding. |
| Emphasis on monetization/legal/marketing pre-docs | Includes release checklist/ASO/soft launch | Explicit monetization, legal register, store listing draft | Mentions asset/audio manifest; less on legal/marketing | Claude weights Play Store compliance/business realities more; Gemini/GPT prioritize build alignment and production flow.[^1_7] |
| AI/LLM-specific documentation | Minor (tailors to stack) | Not central | Recommends an explicit `project-context.md` for Claude Code | Gemini optimizes for AI-assisted workflow alignment; others treat it as implicit practice. |
| Audio/asset manifest as a first-class doc | Mentioned as pipeline/naming guide | Style guide + UI templates | Explicit asset \& SFX prompt manifest | Gemini leans into batching generation (e.g., ElevenLabs) and practical asset planning. |

### 3. Unique Discoveries

| Model | Unique Finding | Why It Matters |
| :-- | :-- | :-- |
| Gemini 3.1 Pro Thinking | Add a repo-root `project-context.md` for Claude Code alignment | Speeds up correct code generation and prevents architectural drift in AI-assisted dev. |
| Claude Opus 4.7 Thinking | Paper-prototype recommendation before coding | Cheapest way to expose rule ambiguity/balance issues before engineering cost. |
| GPT-5.4 Thinking | Formal content pipeline + naming conventions as a dedicated doc | Card counts/variants grow fast; conventions prevent chaos and rework later.[^1_5][^1_4] |

### 4. Comprehensive Analysis

**High-Confidence Findings.** All three models converge on a core idea: for a card game, the most valuable “pre-coding” documents are the ones that eliminate ambiguity in *rules* and create a clean separation between *data* (cards) and *logic* (resolution). GPT-5.4 Thinking, Claude Opus 4.7 Thinking, and Gemini 3.1 Pro Thinking all prioritize a GDD (even if short) plus a dedicated rules/edge-case spec, because card games tend to explode into combinatorial interactions where vague wording becomes bugs. This is especially true once you introduce triggered effects, simultaneous triggers, or replacement effects—so writing down the phase structure, zones, and resolution order early is a major risk reducer.[^1_3][^1_1]

The second strong convergence is the **master card spreadsheet / schema** as the practical heart of development. Both the tabletop and digital workflow benefits are well-documented: spreadsheets organize large sets of card attributes, make balancing math feasible, and can become a pipeline source (CSV → build/import). Board-game designers explicitly use spreadsheets to organize and balance content, and production workflows (like Data Merge) commonly treat “1 row = 1 card,” reinforcing the idea that your spreadsheet can become the canonical dataset. In a Phaser/Capacitor workflow, exporting that sheet to JSON and loading it in-game is a natural extension of this same principle.[^1_4][^1_5]

Third, models agree that **UX flow/wireframes/storyboards** are unusually important on Android because card games live or die on touch interactions and readability. A storyboard of the app’s full flow (launch → play → results → collection/deckbuilding → settings) is repeatedly emphasized as a foundational artifact because it surfaces missing states and reduces iteration churn later. Even if your rules are perfect, a clumsy inspect/target/play interaction will tank retention faster than most mechanical flaws.[^1_3]

**Areas of Divergence.** The main disagreement is *how much* you should document before building. GPT-5.4 Thinking leans toward a fuller “production-ready” doc set (QA plan, analytics taxonomy, launch checklist), reflecting a mindset that treats this as a real mobile product that you might soft-launch and iterate. Claude Opus 4.7 Thinking and Gemini 3.1 Pro Thinking, by contrast, optimize for a solo/AI-assisted developer who needs a tight set of “sources of truth” rather than a full studio documentation suite—hence Claude’s “three docs to unblock coding” and Gemini’s “don’t make massive pitches.” This is less a factual disagreement than a difference in assumed goal: prototype/vertical slice vs. live product.[^1_7][^1_8]

They also diverge in *business/compliance emphasis*. Claude is the only one that explicitly pushes legal/privacy/Play Store policy documentation early (privacy policy, loot box/gambling disclosures, data safety), whereas GPT frames it as a launch checklist item and Gemini barely touches it. If you intend to publish on Google Play with analytics/ads/IAP, Claude’s emphasis becomes more important—those requirements can block release even if the game is done.[^1_7]

Finally, Gemini uniquely tailors documentation to AI-assisted development: a small `project-context.md` that tells your coding agent the architecture and constraints. That’s a workflow optimization rather than a traditional game-dev artifact, but it’s pragmatic if you’re iterating quickly with Claude Code (which you are).

**Unique Insights Worth Noting.** Claude’s recommendation to **paper prototype** is worth treating as a “pre-document” step: it effectively *tests* your rules spec and reveals missing edge cases before you encode them. In card games, this often saves weeks because you discover which rules need formalization (timing windows, targeting constraints, hand limits) through play, not imagination.

Gemini’s `project-context.md` idea is similarly high-leverage in an AI-driven workflow: it functions like a mini-TDD plus coding conventions, preventing the assistant from inventing incompatible patterns mid-project. It also helps keep your Phaser scene logic, state machine, and effect engine consistent over time.

**Recommendations.** If you want the smallest high-impact set to create *before* serious coding, make these in order: (1) **1-page concept + pillars/non-goals** (inside or alongside your GDD), (2) **rules + timing/edge-case spec**, (3) **master card spreadsheet + schema**, (4) **mobile UX flow/wireframes**, and (5) a **TDD-lite** focused on your effect resolution engine and state management. If you expect a real Play Store release, add (6) **analytics event taxonomy + soft-launch checklist** early so instrumentation doesn’t become a painful retrofit.[^1_1][^1_8][^1_4][^1_3][^1_7]
<span style="display:none">[^1_10][^1_11][^1_12][^1_13][^1_14][^1_15][^1_16][^1_17][^1_18][^1_19][^1_20][^1_21][^1_22][^1_23][^1_9]</span>

<div align="center">⁂</div>

[^1_1]: https://www.gitbook.com/blog/how-to-write-a-game-design-document

[^1_2]: https://en.wikipedia.org/wiki/Game_design_document

[^1_3]: https://www.gamedeveloper.com/production/a-breakdown-on-how-to-develop-a-card-game-app

[^1_4]: https://entrogames.substack.com/p/the-ultimate-guide-to-spreadsheets-for-board-game-designers

[^1_5]: https://weheart.games/datamerge/

[^1_6]: https://dlorenzolaguno17.github.io/TDD/

[^1_7]: https://ramiztrtovac.com/useraquisition/mobile-game-launch-checklist-7-steps/

[^1_8]: https://countly.com/blog/how-to-design-a-game-event-taxonomy-for-meaningful-behavioural-analytics

[^1_9]: https://vocal.media/gamers/how-to-develop-a-card-game-app-for-android-in-2025-a-complete-guide

[^1_10]: https://kevurugames.com/blog/how-to-write-a-game-design-document-gdd/

[^1_11]: https://blog.rocketlab.ai/en/soft-launch-best-practices

[^1_12]: https://www.youtube.com/watch?v=WqfZV2Wlb1g

[^1_13]: https://www.reddit.com/r/mAndroidDev/comments/uvgwra/how_to_make_an_android_card_game/

[^1_14]: https://www.codecks.io/blog/writing-modern-game-design-documents/

[^1_15]: https://www.linkedin.com/pulse/complete-guide-card-game-app-development-creatiosoft-zkecc

[^1_16]: https://computergamesmmu.files.wordpress.com/2012/10/technical-design-document-final.pdf

[^1_17]: https://www.facebook.com/groups/132851767828/posts/10161702578587829/

[^1_18]: https://www.reddit.com/r/gamedesign/comments/7ze7xq/finished_game_design_document_examples/

[^1_19]: https://www.reddit.com/r/gamedev/comments/1h872yc/i_am_writing_a_tehnical_design_document/

[^1_20]: https://generalistprogrammer.com/game-analytics

[^1_21]: https://www.reddit.com/r/gamedesign/comments/1j4ohoi/how_do_i_get_started_with_balancing_cards_for_a/

[^1_22]: https://www.youtube.com/watch?v=tmWDzjvCcW0

[^1_23]: https://www.facebook.com/groups/GameDesignersGuild/posts/897826510318095/


---

# is a gdd a game design document?

Yes — **GDD** stands for **Game Design Document**. It's a detailed, living internal document that describes a video game's design, capturing the vision, core loop, systems, content, scope, pillars, and non-goals so the whole team has a shared source of truth. It typically covers gameplay, mechanics, art, level design, story, characters, UI, and assets in enough detail for developers to implement each part.[^2_1][^2_2][^2_3]
<span style="display:none">[^2_4][^2_5][^2_6][^2_7][^2_8]</span>

<div align="center">⁂</div>

[^2_1]: https://en.wikipedia.org/wiki/Game_design_document

[^2_2]: https://www.gitbook.com/blog/how-to-write-a-game-design-document

[^2_3]: https://learn.unity.com/tutorial/fill-out-a-game-design-document

[^2_4]: https://www.reddit.com/r/gamedev/comments/1c5lv3q/what_is_exactly_a_game_design_document/

[^2_5]: https://www.youtube.com/watch?v=bro4rwYVo0I

[^2_6]: https://www.youtube.com/watch?v=hzPZznSmbao

[^2_7]: https://www.codecks.io/blog/writing-modern-game-design-documents/

[^2_8]: https://gamescrye.com/resources/game-design-documents/


---

# and TDD, a technical design document?

Yes — in the game development context, **TDD** stands for **Technical Design Document**. It's a blueprint for programmers that specifies the requirements, implementation approach, and tools/technology needed to build the features defined in the GDD. Typical sections include system architecture, data model, code conventions, external libraries, performance budgets, version control/branching policy, and platform/delivery requirements.[^3_1][^3_2]

Note: "TDD" is an overloaded acronym — in general software contexts it can also mean **Test-Driven Development**, so in game dev it's worth being explicit that you mean the design document.[^3_3]
<span style="display:none">[^3_4][^3_5][^3_6][^3_7]</span>

<div align="center">⁂</div>

[^3_1]: https://dlorenzolaguno17.github.io/TDD/

[^3_2]: https://thescimus.com/blog/writing-better-technical-design-documents-for-development-teams/

[^3_3]: https://learn.microsoft.com/en-us/dynamics365/guidance/patterns/create-functional-technical-design-document

[^3_4]: https://www.reddit.com/r/ExperiencedDevs/comments/1ezocrn/technical_design_documents_how_much_value_do_they/

[^3_5]: https://blog.sofwancoder.com/tdds-and-why-you-need-them

[^3_6]: https://forum.uipath.com/t/technical-design-document-tdd/282349

[^3_7]: https://www.youtube.com/watch?v=T9lrBu6DLtc

