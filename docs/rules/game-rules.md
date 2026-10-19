# Clave

## A Partner Dance Game — Salsa

**2 players · Cooperative · ~30 minutes**

---

## 1. The Dance

Clave is a cooperative card game in which you and your partner dance a salsa song
together. One of you is the **Lead**, the other is the **Follow**. Turn by turn, you
play cards - positions, moves, and flourishes - to dance through the two great sections
of the song: the **cuerpo** and the **montuno**.

You are not competing. You share one **Style** score and one **Connection** track, and
you win or lose together.

**Your goal:** finish the song with the highest combined Style and Connection you can.
**You lose** if your Connection ever drops to 0 - the dance has fallen apart.

## 2. Components

- **Dance cards** — the moves you know:
  - 2 starter decks of 8 cards (one per player)
  - the **Beginner lessons** supply (always available)
  - the **Intermediate lessons** deck (rotating market)
  - the **Advanced lessons** deck (available in the montuno)
- **Song deck** — 16 song cards for the chosen song, one per 8-count of music
  (8 cuerpo cards + 8 montuno cards)
- **Connection track** (0–10) with one shared marker
- **Style counter** (shared)
- **Money** ($) — practice-time tokens

The full v1 card list lives in `docs/cards/`.

## 3. Key Concepts

**The dance state.** The table between you shows the dance as it stands: the couple's
**current position** (the last Position card played) and the **last move** danced.
Everything you play changes or builds on this shared state.

**Positions.** Open (two-hand facing), Closed (full partner frame), Half-Open
(one-hand facing), and Half-Closed (one-sided frame). Positions are where the couple
is; they score no Style themselves, but every move needs the right one.

**Matching.** Every Move card lists the position(s) it can be danced from. A move may
only be played if the current position appears on the move card. The tag names the
position at the start of the 8-count; the move may include a normal re-grip or release
as it unfolds. Half-Open and Half-Closed do not match their larger families
automatically—the card explicitly lists every allowed state. Moves match on positions
only, never on other moves.

**Style** is how good the dance looks. Moves and flourishes earn the Style printed on
them, and the song and phrase bonuses grant more.

**Connection** is the couple's hold on each other and the music. You start at 4. You
lose Connection when you stumble; some song bonuses restore it. It is capped at 10 and
it is worth points at the end - protect it.

**Money.** Each player earns $1 at the start of each of their turns and spends it on
lessons to learn new cards.

## 4. Setup

1. Decide who is the **Lead** and who is the **Follow**. The Lead is the start player.
2. Each player takes their **starter deck** of 8 cards:
   - 2 × Open Position, 1 × Closed Position
   - 1 × Follow Right Turn, 1 × Follow Left Turn
   - 1 × Lead Right Turn, 1 × Lead Left Turn
   - 1 × Cross Body Lead — Closed
3. The floor starts **empty**. The Lead chooses the opening Position from their hand
   on their first card play, followed by a matching Move.
4. Each player shuffles their full starter deck and draws a hand of **4 cards**.
   _Mulligan:_ if your opening hand contains no matching Position and Move, you may
   reveal it, shuffle it back, and draw a new hand once.
5. Set the Connection marker to **4** and Style to **0**. Each player starts with $0.
6. Build the **song deck**: the 8 cuerpo cards in order on top of the 8 montuno cards
   in order, face down.
7. Lay out the lessons:
   - the **Beginner lessons** supply, face up in piles;
   - shuffle the **Intermediate lessons** deck and reveal **3 cards** as the market;
   - set the **Advanced lessons** deck aside, face down - it opens when the montuno
     begins.

## 5. Playing the Game

The song is 16 **8-counts** of music. Players alternate turns, Lead first; each turn
is one 8-count. On your turn, do these steps in order:

1. **Hear the music.** Take $1, then reveal the top song card. Its bonus applies to
   this 8-count only.
2. **Dance.** Play cards from your hand as described in section 6 — or stumble.
3. **Take a lesson** _(optional)_. Buy one card from the lessons (section 8). It goes
   to your discard pile.
4. **Clean up.** Discard **every card remaining in your hand**, then draw a new hand
   of 4 cards. You may not keep cards between turns. If your deck is empty, shuffle
   your discard pile to make a new one and continue drawing.

After the 8th song card of a section has been played, the **phrase ends**: score the
phrase-end bonuses (section 7), move all cards on the table to their owners' discard
piles, and clear the dance state. When the 16th 8-count is done, the song is over —
go to section 10.

## 6. Dancing

On your turn you may play **at most two Position cards, one Move card, and one
Flourish card**, following these rules:

**The first 8-count.** The floor begins empty. The Lead's first card play chooses a
Position to connect in, followed by a matching Move, using the opening rule below.
This opening Position counts toward the turn's Position limit. The Lead may then
transition to another Position and add a Flourish.

**Opening a phrase.** If the dance state is empty (start of a phrase, or after a
stumble), your play must begin with **a Position card and a matching Move card
together**. This establishes where the couple starts. If you cannot or do not want to,
you may dance the basic (play nothing) or stumble — but the state stays empty until
someone opens.

**Dancing a move.** If a position is established, you may play **one Move card whose
position tags include the current position**. It earns its printed Style immediately.
Place it over the previous move, which goes to its owner's discard pile.

**Transitioning.** Immediately after playing a Move card, you may play **one Position
card** on top of the current position — the move carries the couple somewhere new. The
old Position card goes to its owner's discard pile. You cannot change position without
dancing a move first: the dance only travels through movement.

**Flourishing.** You may play **one Flourish card on the Move card you played this
turn**, if the flourish's tags include the position the move was danced from. It earns
its printed Style. It is discarded along with its move.

**Dancing the basic.** You may always play zero cards. The couple dances the basic
step through the 8-count — no Style, no penalty, and the dance state stays as it is.

**Stumbling.** Instead of dancing, you may declare a **stumble** (usually because
nothing in your hand matches the current position). Clear the dance state — all cards
on the table go to their owners' discard piles — and lose **2 Connection**. You play
no other dance cards this turn. Recovery cards soften the fall, played from your hand
as you stumble:

- **Return to Basic** — lose only 1 Connection instead of 2.
- **Reconnect** — lose no Connection at all.

After a stumble the state is empty, so the next dance play must open again with a
position and a matching move.

A stumble replaces only the **Dance** step of the turn. Unless Connection reaches 0,
the player may still take a lesson and must still clean up normally.

> **Example.** The position is Closed. Ana plays **Cross Body Lead — Closed** (tags:
> Closed, Half-Closed — it matches) for 2 Style, then transitions by playing **Open
> Position** on top of Closed, and flourishes the move with **Arm Overhead** for 1 more
> Style. Three cards, 3 Style, and the couple now stands in Open.

## 7. The Song

The song has two phrases of eight 8-counts each:

- **Cuerpo** (8-counts 1–8) — the verses. Beginner and Intermediate lessons are open.
- **Montuno** (8-counts 9–16) — the bridge, mambo, and call-and-response. When the
  montuno begins, flip the **Advanced lessons** deck face up and reveal 2 cards next
  to the Intermediate market. Advanced moves are expensive and flashy — this is the
  part of the song they were made for.

**Song card bonuses.** Each song card names a condition for its 8-count ("+2 Style if
you play a Flourish", "+1 Connection if you change position", …). If the active
player's dance meets it, apply it immediately.

**Phrase-end scoring.** When each phrase ends, score together:

| Bonus        | Condition                                                 | Reward                                 |
| ------------ | --------------------------------------------------------- | -------------------------------------- |
| Clean phrase | Neither player stumbled this phrase                       | +3 Style                               |
| Variety      | Moves were danced from 2+ different positions this phrase | +1 Style per position beyond the first |
| Shared flair | Both players played at least one Flourish this phrase     | +2 Style                               |
| Pose finish  | A Pose card was played in the phrase's final 8-count      | +3 Style                               |

## 8. Lessons

Lessons are how your decks grow beyond the beginner basics. On step 3 of your turn you
may buy **one** card. Bought cards go to your **discard pile** — you practiced it at
home; it shows up on the floor when your deck comes back around.

| Lesson                        | Cost | What you get                                |
| ----------------------------- | ---- | ------------------------------------------- |
| Beginner (group class)        | $1   | Any card from the Beginner supply           |
| Intermediate (private lesson) | $2   | Any face-up card in the Intermediate market |
| Advanced (private lesson)     | $3   | Any face-up Advanced card _(montuno only)_  |

Refill the Intermediate market to 3 (and the Advanced display to 2) whenever a card is
bought.

**Only one private lesson per round.** In each round (one Lead turn plus one Follow
turn), only the first player to buy from the Intermediate or Advanced display may do
so — there is one teacher, and their slot fills up. Beginner group classes are never
limited.

**Learning from your partner.** Once per phrase, at the end of your turn, you may take
a copy of any Move card your partner played earlier this phrase (from the supply) into
your discard pile, for free. Watching is also practice.

## 9. Talking

You are dancing, not conferring. Your hand is private: never name, describe, or count
the cards in it. You may:

- reveal **one card** from your hand to your partner at any time on your turn, as a
  signal of what you can do — then take it back;
- talk generally about intent: "let's get to Closed", "save your money", "big finish?"

## 10. End of the Dance

The dance ends immediately in a **loss** if Connection reaches 0 at any moment.

Otherwise, when the 16th 8-count has been danced, the song ends. Your final score is:

> **Final score = total Style + remaining Connection**

Look up your performance:

| Score | Rating                                            |
| ----- | ------------------------------------------------- |
| 0–19  | First Timers — you survived, and that's salsa too |
| 20–29 | Social Dancers                                    |
| 30–39 | Regulars of the Social                            |
| 40–49 | Crowd Favorites                                   |
| 50–59 | Festival Performers                               |
| 60+   | Soneros of the Floor                              |

## 11. Variant: No Lessons

To play a shorter, purer hand-management game, skip the lessons module entirely: no
money, no markets, no learning from your partner (skip turn step 3).

Instead of the 8-card starter decks, the Lead plays the **Lead full deck** and the
Follow plays the **Follow full deck** — 16-card decks defined in `docs/cards/`, each
oriented toward its role and salted with intermediate moves and a recovery card.
Everything else is unchanged.

## 12. Quick Reference

**Your turn (one 8-count):**

1. Take $1, reveal a song card
2. Dance: up to 2 Positions + 1 Move + 1 Flourish — or basic (nothing) — or stumble
3. Optionally buy 1 lesson (to your discard)
4. Discard freely, draw to 4

**Dance rules:** move must match current position · position change only right after a
move · empty state must be opened with Position + matching Move · flourish only on
your own move, same turn.

**Stumble:** clear the table, −2 Connection (−1 with Return to Basic, −0 with
Reconnect).

**Phrase end (after 8-counts 8 and 16):** clean phrase +3 · variety +1/position after
the first · both flourished +2 · pose finish +3. Clear the table.

**Lose:** Connection 0. **Score:** Style + Connection.
