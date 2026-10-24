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
lose Connection when you stumble and when a call over you drops; some song bonuses
restore it. It is capped at 10 and it is worth points at the end - protect it.

**The call.** As your 8-count ends you choose one of two things: take the song card's
bonus, or **make a call** — one of seven short asks, named aloud, that stands over
your partner's next 8-count. The song card has two faces and you may turn only one of
them. An answered call usually pays more than the song card; a dropped call costs the
couple Connection (section 7.1).

**Afinque.** The groove a couple builds by answering call after call. Each answer adds
a **link**, and the longer the chain the more Style the next answer is worth. Anything
that breaks the conversation takes it back to zero (section 7.2).

**The hold.** The position the couple is in, and the one play that changes it without
a move: before you play anything else in your 8-count you may put a Position card down
to **take** an empty floor or to **adjust** an established one (section 6.4).

**Money.** Each player earns $1 at the start of each of their turns and spends it on
lessons to learn new cards.

## 4. Setup

1. Decide who is the **Lead** and who is the **Follow**. The Lead is the start player.
2. Each player takes their **starter deck** of 8 cards:
   - 2 × Open Position, 1 × Closed Position
   - 1 × Follow Right Turn, 1 × Follow Left Turn
   - 1 × Lead Right Turn
   - 1 × Cross Body Lead — Closed
   - 1 × Hand Twist
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
2. **Dance.** Play cards from your hand as described in section 6 — or stumble. As
   your dance step ends, **take the song or make a call** (section 7.1).
3. **Take a lesson** _(optional)_. Buy one card from the lessons (section 8). A group
   class goes to your discard pile; a private lesson goes on **top of your draw
   pile** — you just learned it.
4. **Clean up.** Discard **every card remaining in your hand**, then draw a new hand
   of 4 cards. You may not keep cards between turns. If your deck is empty, shuffle
   your discard pile to make a new one and continue drawing.

After the 8th song card of a section has been played, the **phrase ends**: score the
phrase-end bonuses (section 7.3), move all cards on the table to their owners'
discard piles, clear the dance state, and reset afinque to zero. When the 16th
8-count is done, the song is over — go to section 10.

## 6. Dancing

On your turn you may play **at most two Position cards, one Move card, and one
Flourish card**, following these rules:

### 6.1 Opening the floor

**The first 8-count.** The floor begins empty. The Lead's first card play chooses a
Position to connect in, followed by a matching Move, using the opening rule below.
This opening Position counts toward the turn's Position limit. The Lead may then
transition to another Position and add a Flourish.

**Opening a phrase.** If the dance state is empty (start of a phrase, or after a
stumble), your play must begin with **a Position card and a matching Move card
together**. This establishes where the couple starts. If you cannot or do not want to,
you may **take the hold** — a lone Position, which sets the room for your partner but
dances nothing (6.4) — or dance the basic (play nothing), or stumble. Until someone
plays a Position, the state stays empty.

### 6.2 Dancing a move

**Dancing a move.** If a position is established, you may play **one Move card whose
position tags include the current position**. It earns its printed Style immediately.
Place it over the previous move, which goes to its owner's discard pile.

**Transitioning.** Immediately after playing a Move card, you may play **one Position
card** on top of the current position — the move carries the couple somewhere new. The
old Position card goes to its owner's discard pile. A move is what carries the couple
from one position to another; the one exception is the hold, played before anything
else in your 8-count and at the price of the song bonus (6.4).

**Flourishing.** You may play **one Flourish card on the Move card you played this
turn**, if the flourish's tags include the position the move was danced from. It earns
its printed Style. It is discarded along with its move.

> **Example.** The position is Closed. Ana plays **Cross Body Lead — Closed** (tags:
> Closed, Half-Closed — it matches) for 2 Style, then transitions by playing **Open
> Position** on top of Closed, and flourishes the move with **Arm Overhead** for 1 more
> Style. Three cards, 3 Style, and the couple now stands in Open.

### 6.3 The basic and the stumble

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

### 6.4 The hold

Before you have played any card this 8-count, you may play **one Position card** from
your hand:

- **Take the hold** — the floor is empty: your Position goes down and the couple
  connects there. (Opening with a Position _and_ a matching Move together is the
  stronger play; taking the hold alone is for a hand that has no matching Move.)
- **Adjust the hold** — a position is established: your Position replaces it, and the
  old card goes to its owner's discard pile. It must be a different position.

Either way the card counts toward your two Positions for the 8-count, and it **gives
up this 8-count's song bonus** — the same price a call costs. You may then dance a
Move from the new position, transition, and flourish as usual, or dance the basic. You
may still make a call. Adjusting counts as changing the position; taking an empty
floor does not.

> **Example.** The floor is Closed and nothing in Beto's hand dances from Closed.
> Before anything else he plays **Open Position** — adjusting the hold — and then
> dances **Follow Left Turn** from Open for 1 Style. He gives up this 8-count's song
> bonus, but the dance did not fall apart, and he may still make a call.

### 6.5 How an 8-count ends

Every 8-count ends on exactly one **rung**. Rungs score nothing by themselves; they
are the record of how the dance is going, and they are what the phrase strip and the
end-of-song recap show you.

| Rung          | When                                                                               | Afinque   | Connection                                     |
| ------------- | ---------------------------------------------------------------------------------- | --------- | ---------------------------------------------- |
| **Perfect**   | a call stood over you and you answered it with a Move                              | +1 link   | —                                              |
| **Clean**     | you danced a Move and no call stood over you                                       | unchanged | —                                              |
| **Awkward**   | you danced no Move — the basic, or a hold alone — or you dropped the call over you | breaks    | −1 if you dropped a call                       |
| **Recovered** | you covered the call over you with a Recovery card                                 | breaks    | —                                              |
| **Break**     | you stumbled                                                                       | breaks    | −2 (−1 with Return to Basic, 0 with Reconnect) |

Where more than one line could fit, they are checked in this order: break, recovered,
perfect, awkward, clean. **Clean** here describes a single 8-count; the **Clean
phrase** bonus in 7.3 is a separate, phrase-wide test, and a phrase can score it
without a single Clean rung in it.

## 7. The Song

The song has two phrases of eight 8-counts each:

- **Cuerpo** (8-counts 1–8) — the verses. Beginner and Intermediate lessons are open.
- **Montuno** (8-counts 9–16) — the bridge, mambo, and call-and-response. When the
  montuno begins, flip the **Advanced lessons** deck face up and reveal 2 cards next
  to the Intermediate market. Advanced moves are expensive and flashy — this is the
  part of the song they were made for.

**Song card bonuses.** Each song card names a condition for its 8-count ("+1 Style if
you play a Flourish", "+1 Connection if you change position", …). If the active
player's dance meets it, apply it immediately — unless that player made a call or
adjusted the hold, which turns the card's other face. The montuno's cards pay far more
than the cuerpo's: the song gets louder as it goes. Every song card except the last of
each phrase also prints a **favoured call** (★). The full deck is listed in
`docs/cards/v1-card-list.md`.

### 7.1 The call and the answer

**Making a call.** As your dance step ends — never on a stumble — you may name one of
the seven calls below instead of taking the song card's bonus. It stands over your
partner's next 8-count. If the song card's condition went unmet, you give up nothing.

You may make a call only if:

- the couple is in a **position** when your 8-count ends — you cannot ask for
  something from a floor you never left (taking the hold is how a player with no
  matching Move still leaves one); and
- your 8-count is **not** the last of its phrase (8-counts 8 and 16): no call crosses
  a phrase ending, so nobody is ever called into 8-count 1 or 9.

| Call                  | Your partner's next 8-count must dance a Move, and…       | Style |
| --------------------- | --------------------------------------------------------- | ----- |
| **Stay with me**      | nothing more — any Move answers                           | 0     |
| **Open it up**        | dance it from Open or Half-Open                           | 1     |
| **Echo me**           | dance one of the Moves **you** danced earlier this phrase | 2     |
| **Change the room**   | change the position during the 8-count                    | 3     |
| **Stay close**        | dance it from Closed or Half-Closed                       | 4     |
| **Style it**          | include a Flourish                                        | 4     |
| **Show me something** | dance a Move worth 3 Style or more                        | 8     |

Every call needs a Move: the basic never answers a call.

**In the pocket.** Each song card prints one ★ **favoured call**. Make that call on
that 8-count and have it answered, and the couple scores **+1 Style** on top — you
asked for exactly what the music was asking for.

**Answering.** At the end of your dance step, if you danced a Move and met the ask,
the call is answered: score its Style, the in-the-pocket bonus if it applies, and the
afinque bonus (7.2). Answering costs you nothing — your own 8-count still takes its
song card or makes a call, as you choose.

**Dropping.** If your dance step ends with the ask unmet, the call **drops**: the
couple loses **1 Connection**, afinque breaks, and the phrase is no longer clean. A
stumble drops the call too, at no cost beyond the stumble's own.

**Covering.** At any point in your dance step you may **cover** the call standing over
you by discarding a **Recovery card** from your hand. The call is cleared: no
Connection lost, the phrase stays clean, afinque breaks to zero, and your dance step
goes on normally. A Recovery card's printed Connection cost applies to stumbles only —
covering a call spends the card and nothing else.

> **Example.** The couple is in Open on 8-count 3 — _Catch the horns_, "+1 Style if
> you play a Flourish". Ana dances **Lead Right Turn** for 1 Style, but she holds no
> Flourish, so the song card would pay her nothing. Instead of taking the song she
> calls **Change the room**, 8-count 3's favoured call (★). On 8-count 4 Beto dances
> **Cross Body Lead — Open** for 2 Style and transitions to **Closed Position**: the
> position changed, so the call is answered — 3 Style for the call and 1 for calling
> in the pocket. Beto makes no call of his own, so he also takes 8-count 4's bonus,
> "+1 Style if your Move is worth 2+ Style". Eight Style across the two 8-counts, and
> afinque is at one link.

### 7.2 Afinque

Afinque is one shared number: the calls the couple has answered in a row, either
player's. Each answer adds a **link**, and the link pays the answer extra Style.

| Links                      | 1  | 2  | 3  | 4  | 5  |
| -------------------------- | -- | -- | -- | -- | -- |
| Extra Style on that answer | +0 | +0 | +1 | +1 | +2 |

Five links is the most it holds. It **breaks to zero** on a dropped call, a covered
call, a stumble, or an 8-count in which no Move was danced, and it **resets to zero**
at every phrase ending. Saying nothing does not break it: take the song, and the chain
survives as long as your partner dances a Move.

> **Example** (the same game, afinque at one link). On 8-count 5 Ana dances and calls
> **Open it up**. Beto answers it from Open on 8-count 6: 1 Style for the call, and
> afinque goes to two links, which pays nothing yet. He ends his dance step by calling
> **Echo me**, 8-count 6's favoured call (★). On 8-count 7 Ana dances **Cross Body
> Lead — Open** — the Move Beto danced on 8-count 4 — and answers: 2 Style for the
> call, 1 in the pocket, and +1 for the third link. Ana may call again on 8-count 7 —
> a call made there stands over 8-count 8, the last of the cuerpo, and a fourth answer
> would pay +1 — but no call may be made on 8-count 8 itself, and the phrase ending
> resets afinque to zero.

### 7.3 Phrase-end scoring

When each phrase ends, score together:

| Bonus        | Condition                                                                            | Reward                                 |
| ------------ | ------------------------------------------------------------------------------------ | -------------------------------------- |
| Clean phrase | Neither player stumbled and no call was dropped this phrase (a covered call is fine) | +3 Style                               |
| Variety      | Moves were danced from 2+ different positions this phrase                            | +1 Style per position beyond the first |
| Shared flair | Both players played at least one Flourish this phrase                                | +2 Style                               |
| Pose finish  | A Pose card was played in the phrase's final 8-count                                 | +4 Style                               |

## 8. Lessons

Lessons are how your decks grow beyond the beginner basics. On step 3 of your turn you
may buy **one** card. A **group class** goes to your discard pile — you practiced it
at home, and it shows up on the floor when your deck comes back around. A **private
lesson** goes on **top of your draw pile**: you just learned it, and you dance it next
turn.

| Lesson                        | Cost | What you get                                | Goes to                   |
| ----------------------------- | ---- | ------------------------------------------- | ------------------------- |
| Beginner (group class)        | $1   | Any card from the Beginner supply           | your discard pile         |
| Intermediate (private lesson) | $2   | Any face-up card in the Intermediate market | the top of your draw pile |
| Advanced (private lesson)     | $3   | Any face-up Advanced card _(montuno only)_  | the top of your draw pile |

**Hand Twist** is a Beginner Flourish, always available for $1, and one copy is in
your starter deck. It adds 1 Style to your Move danced from Open or Half-Open. It is
not in the Intermediate lessons deck.

**Ponche** is a Beginner Flourish too, for $1 from any position. It scores no Style of
its own: it is a **Pose**, the sharp shared accent that stops the music, and it is
what the pose finish bonus (7.3) is for.

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

**A call is public.** You name it aloud, and it stands where both of you can see it
until it is answered, covered, or dropped. It is the one thing you are allowed to ask
for outright — and it says what you want, never what you hold.

## 10. End of the Dance

The dance ends immediately in a **loss** if Connection reaches 0 at any moment —
whether from a stumble or a dropped call. The phrase in progress is not scored, and a
lost dance takes no rating.

Otherwise, when the 16th 8-count has been danced, the song ends. Your final score is:

> **Final score = total Style + remaining Connection**

Look up your performance:

| Score | Rating                                            |
| ----- | ------------------------------------------------- |
| 0–35  | First Timers — you survived, and that's salsa too |
| 36–49 | Social Dancers                                    |
| 50–59 | Regulars of the Social                            |
| 60–69 | Crowd Favorites                                   |
| 70–81 | Festival Performers                               |
| 82+   | Soneros of the Floor                              |

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
2. Dance: up to 2 Positions + 1 Move + 1 Flourish — or basic (nothing) — or stumble;
   then **take the song** or **make a call**
3. Optionally buy 1 lesson (group class → discard · private lesson → top of your draw
   pile)
4. Discard your whole hand, draw 4

**Dance rules:** move must match current position · a Position right after your move
is a transition · a Position before anything else takes or adjusts the hold (and gives
up the song bonus) · empty floor must be opened with Position + matching Move ·
flourish only on your own move, same turn.

**The call:** one of the seven · not on 8-counts 8 or 16 · needs a position on the
floor · answered = its Style, +1 in the pocket (★), + afinque · dropped = −1
Connection · cover it by discarding a Recovery card.

**The seven:** Stay with me 0 · Open it up 1 · Echo me 2 · Change the room 3 · Stay
close 4 · Style it 4 · Show me something 8.

**Afinque** (links 1–5): +0 · +0 · +1 · +1 · +2 extra Style on the answer. Breaks on a
drop, a cover, a stumble, or an 8-count with no Move; resets each phrase.

**Rungs:** perfect · clean · awkward · recovered · break.

**Stumble:** clear the table, −2 Connection (−1 with Return to Basic, −0 with
Reconnect).

**Phrase end (after 8-counts 8 and 16):** clean phrase +3 (no stumble, no dropped
call) · variety +1/position after the first · both flourished +2 · pose finish +4.
Clear the table; afinque resets.

**Lose:** Connection 0. **Score:** Style + Connection.
