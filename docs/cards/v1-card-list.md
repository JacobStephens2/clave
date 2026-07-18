# Clave v1 Card List

The complete card set for Clave v1, as referenced by `docs/rules/game-rules.md`.
Move vocabulary is drawn from the Llorarás social dance breakdown in
`docs/living-documents/0-dance.md`. IDs follow the `<type>_<###>` convention
(see `CLAUDE.md`).

Card types: `pos` (Position), `mov` (Move), `flo` (Flourish), `rec` (Recovery),
`song` (Song). Tier: B = Beginner, I = Intermediate, A = Advanced.

In the digital game the supply is unlimited: purchase piles and "learn from your
partner" copies never run out. The copy counts below define the physical prototype.

## Positions

Positions have no Style value; they set the state that Move tags match against.

| ID | Name | Tier |
| --- | --- | --- |
| pos_001 | Open Position | B |
| pos_002 | Closed Position | B |
| pos_003 | Half-Open Position | I |
| pos_004 | Half-Closed Position | I |

## Moves

| ID | Name | Tier | Position tags | Style |
| --- | --- | --- | --- | --- |
| mov_001 | Follow Right Turn | B | Open | 1 |
| mov_002 | Follow Left Turn | B | Open | 1 |
| mov_003 | Lead Right Turn | B | Open | 1 |
| mov_004 | Lead Left Turn | B | Open | 1 |
| mov_005 | Cross Body Lead | B | Open, Closed | 2 |
| mov_006 | Hesitation | B | Closed | 1 |
| mov_007 | Cross Body Lead — Inside Turn | I | Open, Closed | 3 |
| mov_008 | Cross Body Lead — Outside Turn | I | Open, Closed | 3 |
| mov_009 | New York Walk | I | Half-Open | 3 |
| mov_010 | Change of Place (Enchufla) | I | Closed, Half-Closed | 2 |
| mov_011 | Sombrero | A | Half-Closed | 4 |
| mov_012 | Follow Double Turn | A | Open | 4 |

## Flourishes

Played on the Move you played this turn; tags must include the position the move was
danced from. v1 has no flourish state tracking (no free-hand checks).

| ID | Name | Tier | Position tags | Style | Notes |
| --- | --- | --- | --- | --- | --- |
| flo_001 | Arm Overhead (Lead) | I | any | 1 | |
| flo_002 | Arm Overhead (Follow) | I | any | 1 | |
| flo_003 | Hand Twist | I | Open, Half-Open | 1 | |
| flo_004 | Dip | A | Closed | 3 | **Pose** |

## Recovery

Played from hand when you stumble; they replace the normal −2 Connection cost.

| ID | Name | Tier | Effect |
| --- | --- | --- | --- |
| rec_001 | Return to Basic | B | Stumble costs 1 Connection instead of 2 |
| rec_002 | Reconnect | I | Stumble costs 0 Connection |

## Decks & Supplies

### Starter deck (one per player, lessons game)

| Card | Copies |
| --- | --- |
| pos_001 Open Position | 3 |
| pos_002 Closed Position | 1 |
| mov_001 Follow Right Turn | 1 |
| mov_002 Follow Left Turn | 1 |
| mov_003 Lead Right Turn | 1 |
| mov_004 Lead Left Turn | 1 |

### Beginner supply (always available, $1)

| Card | Copies |
| --- | --- |
| pos_001 Open Position | 6 |
| pos_002 Closed Position | 6 |
| mov_001–mov_004 (each turn) | 2 each |
| mov_005 Cross Body Lead | 4 |
| mov_006 Hesitation | 3 |
| rec_001 Return to Basic | 4 |

### Intermediate lessons deck (shuffled; market of 3; $2)

| Card | Copies |
| --- | --- |
| pos_003 Half-Open Position | 3 |
| pos_004 Half-Closed Position | 3 |
| mov_007 CBL — Inside Turn | 2 |
| mov_008 CBL — Outside Turn | 2 |
| mov_009 New York Walk | 2 |
| mov_010 Change of Place | 2 |
| flo_001 Arm Overhead (Lead) | 2 |
| flo_002 Arm Overhead (Follow) | 2 |
| flo_003 Hand Twist | 2 |
| rec_002 Reconnect | 2 |

22 cards.

### Advanced lessons deck (shuffled; display of 2; $3; montuno only)

| Card | Copies |
| --- | --- |
| mov_011 Sombrero | 2 |
| mov_012 Follow Double Turn | 2 |
| flo_004 Dip | 2 |

6 cards.

## Song Deck — Llorarás (Oscar D'León)

16 cards, played in this order (cuerpo 1–8, montuno 9–16). Sections follow the
bar-by-bar structure in `0-dance.md`; v1 excludes the intro and the cierre. Each bonus
applies to the active player's 8-count only.

| ID | # | Section | Bonus |
| --- | --- | --- | --- |
| song_001 | 1 | Cuerpo · Verse 1 | Settle in: +1 Connection if you play a Move worth 2 Style or less |
| song_002 | 2 | Cuerpo · Verse 1 | +1 Style if your Move is danced from Open |
| song_003 | 3 | Cuerpo · Horns | +2 Style if you play a Flourish |
| song_004 | 4 | Cuerpo · Horns | +1 Style if your Move is worth 2+ Style |
| song_005 | 5 | Cuerpo · Verse 2 | Stay close: +1 Connection if you play no Position card |
| song_006 | 6 | Cuerpo · Verse 2 | +1 Style if your Move is danced from the same position as the previous Move |
| song_007 | 7 | Cuerpo · Horns | +2 Style if you play a Flourish |
| song_008 | 8 | Cuerpo · Verse 3 | Verse's end: +1 Connection if this 8-count ends in Closed |
| song_009 | 9 | Montuno · Puente | +1 Connection if you change position this 8-count |
| song_010 | 10 | Montuno · Puente | Echo: +2 Style if you play a Move your partner has played this game |
| song_011 | 11 | Montuno · Mambo | +2 Style if your Move is worth 3+ Style |
| song_012 | 12 | Montuno · Mambo | +2 Style if you play a Flourish |
| song_013 | 13 | Montuno · Mambo | In full swing: +1 Style and +1 Connection if you play 3+ cards |
| song_014 | 14 | Montuno · Pregón | Call: +2 Style if you play a Move your partner played earlier this phrase |
| song_015 | 15 | Montuno · Coro | Response: +2 Style if your Move is danced from Half-Open or Half-Closed |
| song_016 | 16 | Montuno · Coro | Big finish: +3 Style if you play a Pose; otherwise +1 Style if you play a Flourish |

## Variant Full Decks (no-lessons game)

16 cards each, role-oriented, per rulebook section 11.

### Lead full deck

| Card | Copies |
| --- | --- |
| pos_001 Open Position | 4 |
| pos_002 Closed Position | 2 |
| pos_004 Half-Closed Position | 1 |
| mov_003 Lead Right Turn | 2 |
| mov_004 Lead Left Turn | 1 |
| mov_005 Cross Body Lead | 2 |
| mov_006 Hesitation | 1 |
| mov_008 CBL — Outside Turn | 1 |
| mov_010 Change of Place | 1 |
| rec_001 Return to Basic | 1 |

### Follow full deck

| Card | Copies |
| --- | --- |
| pos_001 Open Position | 4 |
| pos_002 Closed Position | 2 |
| pos_003 Half-Open Position | 1 |
| mov_001 Follow Right Turn | 2 |
| mov_002 Follow Left Turn | 1 |
| mov_007 CBL — Inside Turn | 1 |
| mov_009 New York Walk | 1 |
| flo_002 Arm Overhead (Follow) | 1 |
| flo_003 Hand Twist | 1 |
| flo_004 Dip | 1 |
| rec_001 Return to Basic | 1 |

All Style values, copy counts, and song bonuses are the v1 baseline for playtesting.
