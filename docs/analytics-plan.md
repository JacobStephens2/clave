# Analytics & Event Taxonomy

## Naming Convention
- snake_case, `<system>_<action>`: `match_start`, `card_played`

## Core Events
| Event | Properties |
|---|---|
| session_start | days_since_install, session_number |
| tutorial_step | step_id, completed |
| match_start | mode, deck_id, opponent_type |
| card_played | card_id, turn, hand_size |
| match_end | result, turns, duration_s |
| purchase_complete | item_id, revenue_usd |

## KPIs
- D1, D7, D30 retention
- Tutorial completion %
- Avg match length
- ARPU / ARPDAU
