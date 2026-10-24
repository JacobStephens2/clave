# Clave v1 Card List

The complete card set for Clave v1, as referenced by `docs/rules/game-rules.md`.
Move vocabulary is drawn from the Llorarás social dance breakdown in
`docs/living-documents/0-dance.md`. IDs follow the `<type>_<###>` convention
(see `CLAUDE.md`).

Card types: `pos` (Position), `mov` (Move), `flo` (Flourish), `rec` (Recovery),
`song` (Song). Tier: B = Beginner, I = Intermediate, A = Advanced. The seven **calls**
(`call_001`–`call_007`) are listed here too, but they are not cards — see below.

In the digital game the supply is unlimited: purchase piles and "learn from your
partner" copies never run out. The copy counts below define the physical prototype.

## Positions

Positions have no Style value; they set the state that Move tags match against. Open
means a two-hand facing hold, Half-Open a one-hand facing hold, Closed a full partner
frame, and Half-Closed a one-sided frame. These are exact game states: a move lists
every state from which it can plausibly begin, including any re-grip or release that
happens inside its 8-count.

| ID      | Name                 | Tier |
| ------- | -------------------- | ---- |
| pos_001 | Open Position        | B    |
| pos_002 | Closed Position      | B    |
| pos_003 | Half-Open Position   | I    |
| pos_004 | Half-Closed Position | I    |

## Moves

| ID      | Name                           | Tier | Position tags                        | Style |
| ------- | ------------------------------ | ---- | ------------------------------------ | ----- |
| mov_001 | Follow Right Turn              | B    | Open, Closed, Half-Open              | 1     |
| mov_002 | Follow Left Turn               | B    | Open, Half-Open                      | 1     |
| mov_003 | Lead Right Turn                | B    | Open, Half-Open                      | 1     |
| mov_004 | Lead Left Turn                 | B    | Open, Half-Open                      | 1     |
| mov_005 | Cross Body Lead — Open         | B    | Open, Half-Open                      | 2     |
| mov_013 | Cross Body Lead — Closed       | B    | Closed, Half-Closed                  | 2     |
| mov_006 | Hesitation                     | B    | Open, Closed, Half-Open, Half-Closed | 1     |
| mov_007 | Cross Body Lead — Inside Turn  | I    | Open, Closed, Half-Open, Half-Closed | 3     |
| mov_008 | Cross Body Lead — Outside Turn | I    | Open, Closed, Half-Open, Half-Closed | 3     |
| mov_009 | New York Walk                  | I    | Open, Half-Open                      | 3     |
| mov_010 | Change of Place (Enchufla)     | I    | Open, Half-Open                      | 2     |
| mov_011 | Sombrero                       | A    | Open, Half-Open                      | 4     |
| mov_012 | Follow Double Turn             | A    | Open, Half-Open                      | 4     |

## Flourishes

Played on the Move you played this turn; tags must include the position the move was
danced from. v1 has no flourish state tracking (no free-hand checks).

| ID      | Name                  | Tier | Position tags   | Style | Notes    |
| ------- | --------------------- | ---- | --------------- | ----- | -------- |
| flo_001 | Arm Overhead (Lead)   | I    | any             | 1     |          |
| flo_002 | Arm Overhead (Follow) | I    | any             | 1     |          |
| flo_003 | Hand Twist            | B    | Open, Half-Open | 1     |          |
| flo_004 | Dip                   | A    | Closed          | 3     | **Pose** |
| flo_005 | Ponche                | B    | any             | 0     | **Pose** |

Ponche scores no Style of its own: it is the phrase-ending accent, and it is there to
make an 8-count a Pose for the pose finish bonus and song card 16. See the 2026-10-23
ruling for its basis and why its Style is 0.

## Recovery

Played from hand when you stumble; they replace the normal −2 Connection cost.

| ID      | Name            | Tier | Effect                                  |
| ------- | --------------- | ---- | --------------------------------------- |
| rec_001 | Return to Basic | B    | Stumble costs 1 Connection instead of 2 |
| rec_002 | Reconnect       | I    | Stumble costs 0 Connection              |

## Decks & Supplies

### Starter deck (one per player, lessons game)

| Card                      | Copies |
| ------------------------- | ------ |
| pos_001 Open Position     | 2      |
| pos_002 Closed Position   | 1      |
| mov_001 Follow Right Turn | 1      |
| mov_002 Follow Left Turn  | 1      |
| mov_003 Lead Right Turn   | 1      |
| mov_013 CBL — Closed      | 1      |
| flo_003 Hand Twist        | 1      |

Hand Twist replaced Lead Left Turn here on 2026-10-23 so that both players can
flourish from the first 8-count; Lead Left Turn remains a $1 Beginner lesson. The
variant full decks below are unchanged.

### Beginner supply (always available, $1)

| Card                        | Copies |
| --------------------------- | ------ |
| pos_001 Open Position       | 6      |
| pos_002 Closed Position     | 6      |
| mov_001–mov_004 (each turn) | 2 each |
| mov_005 CBL — Open          | 2      |
| mov_013 CBL — Closed        | 2      |
| mov_006 Hesitation          | 3      |
| flo_003 Hand Twist          | 2      |
| flo_005 Ponche              | 2      |
| rec_001 Return to Basic     | 4      |

### Intermediate lessons deck (shuffled; market of 3; $2)

| Card                          | Copies |
| ----------------------------- | ------ |
| pos_003 Half-Open Position    | 3      |
| pos_004 Half-Closed Position  | 3      |
| mov_007 CBL — Inside Turn     | 2      |
| mov_008 CBL — Outside Turn    | 2      |
| mov_009 New York Walk         | 2      |
| mov_010 Change of Place       | 2      |
| flo_001 Arm Overhead (Lead)   | 2      |
| flo_002 Arm Overhead (Follow) | 2      |
| rec_002 Reconnect             | 2      |

20 cards.

### Advanced lessons deck (shuffled; display of 2; $3; montuno only)

| Card                       | Copies |
| -------------------------- | ------ |
| mov_011 Sombrero           | 2      |
| mov_012 Follow Double Turn | 2      |
| flo_004 Dip                | 2      |

6 cards.

## Song Deck — Llorarás (Oscar D'León)

16 cards, played in this order (cuerpo 1–8, montuno 9–16). Sections follow the
bar-by-bar structure in `0-dance.md`; v1 excludes the intro and the cierre. Each bonus
applies to the active player's 8-count only, and only if that player took the song —
making a call or adjusting the hold gives it up (rulebook 7.1).

The ★ column is the card's **favoured call**: make that call on that 8-count and have
it answered, and the couple scores +1 Style on top. Counts 8 and 16 print none, because
no call may be made on the last 8-count of a phrase. Every favoured call on counts 1–7
must be answerable from the starter deck; a content test enforces it.

| ID       | #  | Section          | Title            | Bonus                                                                       | ★ Favoured call   |
| -------- | -- | ---------------- | ---------------- | --------------------------------------------------------------------------- | ----------------- |
| song_001 | 1  | Cuerpo · Verse 1 | Settle in        | +1 Connection if you play a Move worth 2 Style or less                      | Stay with me      |
| song_002 | 2  | Cuerpo · Verse 1 | Open invitation  | +1 Style if your Move is danced from Open                                   | Open it up        |
| song_003 | 3  | Cuerpo · Horns   | Catch the horns  | +1 Style if you play a Flourish                                             | Change the room   |
| song_004 | 4  | Cuerpo · Horns   | Make it count    | +1 Style if your Move is worth 2+ Style                                     | Open it up        |
| song_005 | 5  | Cuerpo · Verse 2 | Stay close       | +1 Connection if you play no Position card                                  | Stay close        |
| song_006 | 6  | Cuerpo · Verse 2 | Hold the thread  | +1 Style if your Move is danced from the same position as the previous Move | Echo me           |
| song_007 | 7  | Cuerpo · Horns   | Answer the horns | +1 Style if you play a Flourish                                             | Style it          |
| song_008 | 8  | Cuerpo · Verse 3 | Verse's end      | +1 Connection if this 8-count ends in Closed                                | —                 |
| song_009 | 9  | Montuno · Puente | Cross the bridge | +1 Style and +1 Connection if you change position this 8-count              | Change the room   |
| song_010 | 10 | Montuno · Puente | Echo             | +4 Style if you play a Move your partner has played this game               | Echo me           |
| song_011 | 11 | Montuno · Mambo  | Bring the mambo  | +6 Style if your Move is worth 3+ Style                                     | Show me something |
| song_012 | 12 | Montuno · Mambo  | Shine            | +4 Style if you play a Flourish                                             | Style it          |
| song_013 | 13 | Montuno · Mambo  | In full swing    | +3 Style and +1 Connection if you play 3+ cards                             | Echo me           |
| song_014 | 14 | Montuno · Pregón | Call             | +4 Style if you play a Move your partner played earlier this phrase         | Style it          |
| song_015 | 15 | Montuno · Coro   | Response         | +4 Style if you answer the call standing over you                           | Style it          |
| song_016 | 16 | Montuno · Coro   | Big finish       | +7 Style if you play a Pose; otherwise +3 Style if you play a Flourish      | —                 |

Card 14 is titled **Call** and card 15 **Response** — the coro-pregón the montuno is
built on. They are song cards, not the calling mechanic; count 14 is simply where the
song names what the couple does everywhere.

## Calls

The seven calls are **not cards**. They are clauses in the content's
`rules.call.options`, with ids `call_001`–`call_007`: no art, no copies, no deck. A
call is made as a dance step ends, stands over the partner's next 8-count, and is
answered, covered, or dropped there (rulebook 7.1). Every call also requires that the
answerer danced a Move — the basic never answers.

| ID       | Name              | The ask (as the caller says it)                | Style |
| -------- | ----------------- | ---------------------------------------------- | ----- |
| call_001 | Stay with me      | dance a Move — any Move                        | 0     |
| call_002 | Open it up        | dance your Move from Open or Half-Open         | 1     |
| call_003 | Change the room   | change the position during your 8-count        | 3     |
| call_004 | Echo me           | dance a Move I have already danced this phrase | 2     |
| call_005 | Stay close        | dance your Move from Closed or Half-Closed     | 4     |
| call_006 | Style it          | include a Flourish                             | 4     |
| call_007 | Show me something | dance a Move worth 3 Style or more             | 8     |

Shared values (content `rules.call`): in the pocket **+1 Style** · a dropped call
**−1 Connection** · afinque bonus by link **+0 / +0 / +1 / +1 / +2**, cap 5, reset at
every phrase ending.

## Variant Full Decks (no-lessons game)

16 cards each, role-oriented, per rulebook section 11.

### Lead full deck

| Card                         | Copies |
| ---------------------------- | ------ |
| pos_001 Open Position        | 4      |
| pos_002 Closed Position      | 2      |
| pos_004 Half-Closed Position | 1      |
| mov_003 Lead Right Turn      | 2      |
| mov_004 Lead Left Turn       | 1      |
| mov_005 CBL — Open           | 1      |
| mov_013 CBL — Closed         | 1      |
| mov_006 Hesitation           | 1      |
| mov_008 CBL — Outside Turn   | 1      |
| mov_010 Change of Place      | 1      |
| rec_001 Return to Basic      | 1      |

### Follow full deck

| Card                          | Copies |
| ----------------------------- | ------ |
| pos_001 Open Position         | 4      |
| pos_002 Closed Position       | 2      |
| pos_003 Half-Open Position    | 1      |
| mov_001 Follow Right Turn     | 2      |
| mov_002 Follow Left Turn      | 1      |
| mov_007 CBL — Inside Turn     | 1      |
| mov_009 New York Walk         | 1      |
| flo_002 Arm Overhead (Follow) | 1      |
| flo_003 Hand Twist            | 1      |
| flo_004 Dip                   | 1      |
| rec_001 Return to Basic       | 1      |

All Style values, copy counts, song bonuses, and call values are tuning numbers, not
settled ones: they live in content JSON, they were last re-measured on 2026-10-23, and
they are the figures the couch gate is meant to argue with.
