# Rules & Mechanics Specification

## 1. Components
- Deck size:
- Hand size (start / max):
- Zones: deck, hand, play, discard, exile, <other>

## 2. Turn Structure
1. Upkeep
2. Draw
3. Main / Action
4. Resolution
5. End / Cleanup

## 3. Card Anatomy
| Field | Type | Notes |
|---|---|---|
| id | string | unique |
| name | string | |
| cost | int | |
| type | enum | Attack/Skill/... |
| rarity | enum | |
| keywords | string[] | |
| effects | object[] | see effect DSL |
| art | string | asset id |
| flavor | string | |

## 4. Keyword Glossary
- **<Keyword>:** <precise definition>
- **<Keyword>:** <precise definition>

## 5. Resolution Order
- Simultaneous triggers:
- Replacement effects:
- Priority / stack model:

## 6. Targeting Rules
- Legal targets:
- Illegal target handling:

## 7. Edge Cases
- What if the deck is empty on draw?
- What if hand exceeds max at end of turn?
- What if a destroyed card would trigger on-destroy?
- <Add as discovered>

## 8. AI Opponent Legality
- Decision constraints:
- Difficulty knobs:
