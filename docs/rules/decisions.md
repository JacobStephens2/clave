game-rules.md should have the rules written in the style of a board game rulebook.

The eight card starting deck is for use with the lessons module. When the lessons module is not used, the players should start with a full deck, a lead oriented deck for the lead player and a follow oriented deck for the follow player.

The connection value starts at a mid-low value in the connection range.

The final score formula is style plus connection.

The recovery connection cost is 2. Dedicated recovery / reset cards exist. One reduces the connection penalty to 1, and one reduces the recovery connection cost to 0.

Moves match only on positions.

v1 of Clave excludes flourish state tracking, and it excludes the cierre.

v1 of Clave includes the lessons module.

## 2026-07-18 — Stumble turn timing

A stumble replaces only step 2, **Dance**. If the stumble does not reduce Connection
to 0, the active player continues to step 3 (the optional lesson) and step 4
(cleanup). This keeps “no other dance cards” scoped to the dance step and avoids a
bad-hand death spiral. Connection reaching 0 still ends the game immediately.

## 2026-07-19 — Position tags describe entry compatibility

A Move's position tags describe the couple's state at the **start** of that 8-count.
The figure may contain a normal re-grip, release, or opening-out action; those internal
changes do not require a separate Position card. Half-Open and Half-Closed remain
exact game states rather than inheriting every Open or Closed match automatically, so
each card explicitly lists every compatible state. This keeps compatibility
data-driven and lets individual handhold requirements remain tactically meaningful.

The starter deck now contains 2 Open Positions, 1 Closed Position, the four basic
turns, and 1 Cross Body Lead. Cross Body Lead is the starter's reliable bridge out of
Closed and replaces the third Open Position; the starter remains eight cards.
_The starter's contents are amended again by the 2026-10-23 Hand Twist ruling below._

## 2026-07-19 — Foundational Cross Body Lead is split by entry family

The former all-position **Cross Body Lead** is now two Beginner Move cards. **Cross
Body Lead — Open** (`mov_005`) lists Open and Half-Open; **Cross Body Lead — Closed**
(`mov_013`) lists Closed and Half-Closed. Both remain worth 2 Style. This makes the
starting handhold a visible card choice instead of hiding two distinct setups behind
one universal card.

The eight-card starter uses the Closed version, preserving its second route from
Closed alongside Follow Right Turn. Both versions are always available as Beginner
lessons, and the Lead full deck divides its former two foundational Cross Body Leads
into one Open and one Closed copy.

## 2026-07-20 — The song begins in Open Position

_Superseded by the 2026-10-19 opening-Position ruling below._

Before either player shuffles, the Lead places one Open Position from their starter
deck on the floor. It remains a Lead-owned card and is discarded normally when a
transition, stumble, or phrase ending clears it. The first turn therefore follows the
normal established-floor order: **Move, optional Position, optional Flourish**. This
starting card is not a Position played during that turn.

Only the beginning of the game receives this preset Position. A later empty floor—at
the second phrase or after a stumble—still requires an atomic matching Position + Move
opening. Opening-hand mulligans now check for a Move compatible with the visible Open
Position. The digital floor is displayed as Move → Position → Flourish to teach the
usual play sequence; an empty-floor Position may still be staged in the middle slot
before its matching Move is supplied.

## 2026-07-20 — End-of-turn cleanup discards the whole hand

At the end of every turn, the active player discards **all** cards remaining in their
hand and draws a new hand of four. There is no choice to retain cards or discard only
some of them. If the draw pile runs out, the discard pile is shuffled and drawing
continues, following the standard deck-building cleanup rhythm exemplified by
Dominion.

This ruling replaces the former optional “Freshen Up” selection. A surviving stumble
still proceeds through the optional lesson and mandatory cleanup; only the contents
of cleanup have changed. The web client commits cleanup when the player finishes the
lesson step and animates the entire remaining hand into the discard pile before the
privacy handoff appears.

## 2026-10-19 — The Lead chooses the opening Position (issue #18)

The song starts on an empty floor, with both full eight-card starter decks shuffled
and four cards dealt to each player. No Open Position is placed automatically. The
Lead's first card play chooses how to connect: a Position from their hand followed
by a matching Move. The existing atomic Position + Move opening rule applies, with
the web client staging the Position before committing the pair. The opening Position
counts toward the turn's two-Position limit; a transition and Flourish may follow.

This supersedes the preset Open Position ruling above. Opening-hand mulligans check
for a matching Position and Move in hand for either role. Basic and Stumble remain
available, and leave the floor empty until someone opens. Later empty floors and
established-floor Move → Position → Flourish play are unchanged.

## 2026-10-19 — A Flourish in the Beginner supply (issue #19)

Hand Twist (`flo_003`) moves from Intermediate to Beginner so both players can buy a
Flourish from the always-available $1 supply. Its role-neutral name and Open/Half-Open
tags make it a fit for the Beginner supply; its 1 Style and play requirements stay
the same. Its two physical copies move to the Beginner supply, leaving 20 cards in
the Intermediate lessons deck. Starter and full decks keep their existing contents.
_The starter clause is superseded by the 2026-10-23 Hand Twist ruling below, which
puts one copy of Hand Twist in the starter deck; the full decks are unchanged._

## 2026-10-23 — The song card has two faces: take the song, or make a call

As a dance step ends the active player turns one face of the song card, not both:
either take its bonus, or **make a call** that stands over the partner's next 8-count.
Giving up an unmet condition costs nothing. Adjusting the hold gives the bonus up the
same way. A stumble turns neither face.

Reason: the baseline game had no decision worth making. Across 1,000 competent
simulated games the whole turn was worth **1.90** Style-plus-Connection from best play
to worst, with ~2.9 complete card sequences tied for best; the loss path had never run
(**0.0%** losses, 0.00 stumbles per game); 76% of games landed in one rating band and
the score spread was **sd/mean 0.08**. Pricing the song card against a call takes the
measured per-turn spread to 7.4–13.0 points and makes difficulty a dial the pair turns
every 8-count: 0.0% losses for cautious calling, 0.5% sensible, 28.8% bold, 99.8%
reckless.

## 2026-10-23 — The seven calls are the game's own vocabulary, and `call_` is not a card

The calls are Stay with me (0 Style), Open it up (1), Echo me (2), Change the room (3),
Stay close (4), Style it (4), and Show me something (8). They live in content as
`rules.call.options` with ids `call_001`–`call_007`. A call is a clause, not a card: no
art, no copies, no deck, and the five card-ID prefixes (`pos_`, `mov_`, `flo_`, `rec_`,
`song_`) are unchanged. `CLAUDE.md` and `AGENTS.md` now list `call_` alongside them so
the convention stays discoverable. "Style it" replaces the design drafts' "Give me a
turn", which asked for a Flourish rather than a turn.

Named plainly, because the repo holds itself to a sourcing standard: **the seven English
phrases are Clave's own vocabulary, not scene doctrine.** Lead-follow compression and
extension in `research/salsa-dance-positions-moves-footwork-and-flourishes.md`
_inspired_ Stay close and Open it up, but the source describes compression as a signal
for a backward step and extension as one for a forward step or turn setup — the
analogy is ours. **Afinque** (the locked-in groove) and the coro-pregón structure
behind the montuno are attested terms; the call names are a design conceit, and the
rulebook presents them as things a couple says to each other, not as dance terms.

## 2026-10-23 — No call crosses a phrase ending, and none is made from an empty floor

A call may not be made on the last 8-count of a phrase (8-counts 8 and 16), so nobody
is ever called into 8-count 1 or 9: the phrase ending clears the table and resets
afinque, and an ask may not survive it. A call also requires a position on the floor
when the dance step ends — you cannot ask for something from a floor you never left.
Taking the hold is how a player with no matching Move still leaves one.

Two invariants follow and are asserted in the engine's property walk: no call stands
over the dance step that begins 8-count 1 or 9, and no standing call ever faces an
empty floor. A walk of 4,622 states across four policies violated neither, and found
no state in which a call stood over an empty floor. The floor test belongs to the
moment the call is *made*, not the moment it is answered: a player who danced the basic
may still call, which is legitimate and rather good play ("I had nothing, but I am
still asking you for something") as long as the couple is in a position.

## 2026-10-23 — A dropped call costs 1 Connection, and a Recovery card covers it

A call that goes unanswered **drops** at the end of the answerer's dance step: the
couple loses **1 Connection**, afinque breaks, and the phrase is no longer clean. A
stumble drops the call too, at no cost beyond the stumble's own. Instead, at any point
in the dance step the answerer may **cover** the call by discarding a Recovery card
from hand: the call is cleared, no Connection is lost, the phrase stays clean, and
afinque still breaks. A Recovery card's printed Connection cost applies to stumbles
only. Covering is its own action, taken during the dance step, so covering a call and
making one are never the same decision.

If a dropped call takes Connection to 0 the game is lost immediately, on the same
terminal path a stumble uses: the final score is Style alone, there is no rating, the
phrase is not scored, and the standing call is cleared rather than left over a dead
game.

Reason: this is the first involuntary Connection cost in the game's history. The
baseline measured **0.0%** losses and 0.00 stumbles over 1,000 competent games —
Connection was a one-way ratchet. Priced at 1, every measured loss is now a dropped
call while stumbles stay at 0.00 for every competent dial, and Recovery cards go from
never bought by any policy in 1,800 games to 1.8–3.5 copies per game. Taking the
Recovery valve away moves bold play from 28.8% losses to 79%, which is why the cover
is a rule and not a nicety.

## 2026-10-23 — Afinque: links, the bonus table, and the phrase reset

Afinque is one shared count of calls answered in a row, either player's. Each answer
adds a link, to a maximum of five, and pays that answer extra Style from the table
+0 / +0 / +1 / +1 / +2 (content `rules.call.afinqueBonus`). It breaks to zero on a
dropped call, a covered call, a stumble, or any 8-count in which no Move was danced,
and it resets to zero at every phrase ending. Declining to call does not break it — the
chain survives as long as the partner dances a Move, which is the pair's free stopping
point.

Reason: the table pays nothing until the third link so that a chain is something the
pair builds rather than a bonus for a single answer. Measured, the longest run is
5.0 links for a cautious pair and 3.1 for a bold one, and all calling together stays
23–41% of final Style — inside the 45% ceiling that keeps the dance, rather than the
conversation about it, the game. Stay with me stays at 0 Style for the same reason: at
1 Style a cautious pair that answers nothing else scored 76.3 against 62.2, at an
unchanged 0.0% loss rate — fourteen free points for the pair that takes no risk.

At the other end of the ladder, **Show me something is deliberately priced at 8** —
raised from 6 on re-measurement. It is the one ask a deck of $1 Beginner Moves cannot
answer (0.0% answerable for that deck against 14% for one that buys Intermediate and
Advanced Moves), so it is where the lessons module is paid for: at 6 Style the best
deck beat buy-the-$1-Move-every-turn by 7.8%, at 8 by 11.1%. A tuner should not move
this number casually — it carries the deckbuilding target on its own, and the call's
whole share of final Style stays at 23–41% either way.

## 2026-10-23 — Taking and adjusting the hold

Before playing any other card in an 8-count, a player may play one Position card from
hand: **taking the hold** on an empty floor, or **adjusting the hold** on an
established one (the replaced card goes to its owner's discard pile; the same position
is refused). It counts toward the turn's two Positions, it gives up this 8-count's song
bonus, and a Move, a transition, and a Flourish may follow as usual. Adjusting counts
as changing the position; taking an empty floor does not.

Reason: before this, what a player could be asked for was decided entirely by the floor
their partner happened to leave. With the hold rules switched off, Stay close is
answerable on 7–11% of 8-counts, on 9–11% of 8-counts no call at all can be answered,
and the dead-turn rate is 10–11%; with them those measure 33–34%, 4–5% and 6–9%, and a
sensible pair scores 60.3 instead of 52.5. The forfeited song bonus is what keeps it
from being free. Not claimed: the hold does **not** fix the count-9 dead turn (33% with
the hold against 31% without — the empty-floor opening already plays a Position and a
matching Move together there).

## 2026-10-23 — The five-rung resolution ladder

Every 8-count ends on exactly one rung — **perfect**, **clean**, **awkward**,
**recovered**, or **break** — tested in that precedence order: break, recovered,
perfect, awkward, clean. Rungs carry no scoring of their own; the Connection and
afinque effects in the rulebook's table belong to the rules that cause them (the drop,
the cover, the stumble). History entries keep the existing `outcome` field with its
existing meaning and gain `rung` beside it, so stored games stay readable.

Reason, with its limit stated: this is the transcript layer the phrase strip and the
end-of-song recap read, and the concept brief's promise that imperfect outcomes get
"their own texture and scoring" is half kept here — the texture is the ladder, the
scoring is the drop and the cover. All five rungs occur in play: perfect 0–78.9%, clean
12.1–94.0%, awkward 5.1–23.0%, recovered 0–19.6%, break 0% for every competent dial and
16.1% for random play.

## 2026-10-23 — A clean phrase requires no stumble and no dropped call

The Clean phrase bonus (+3 Style) now requires that neither player stumbled **and**
that no call was dropped this phrase. A covered call leaves the phrase clean.

Reason: it fired in **100.0%** of phrases for every competent policy — a participation
prize. Re-conditioned it measures 37.0% for a sensible pair, 84.5% for a cautious one
and 9.2% for a bold one, inside the 35–75% band set for ordinary play. The collision is
deliberate and bounded: **Clean** is also the name of an 8-count rung (a Move danced,
no call standing). The rung describes one 8-count, the bonus tests a whole phrase, and
a phrase can score the bonus without containing a single Clean rung — rulebook 6.5 says
so where a player will read it.

## 2026-10-23 — Hand Twist joins the starter in place of Lead Left Turn

The eight-card starter deck is now 2 × Open Position, 1 × Closed Position, Follow Right
Turn, Follow Left Turn, Lead Right Turn, Cross Body Lead — Closed, and **Hand Twist**.
Lead Left Turn leaves the starter and stays a $1 Beginner lesson. This supersedes
"Starter and full decks keep their existing contents" in the 2026-10-19 ruling on a
Flourish in the Beginner supply, for the starter only: the no-lessons variant's full
decks (rulebook §11) are unchanged.

Reason: Lead Left Turn and Lead Right Turn are mechanically identical in v1 (Open and
Half-Open, 1 Style), so the starter spent two of its eight cards on the same card —
while no player could flourish at all before buying one, which measured as **0.0%**
shared flair and a pose finish in ~**1.2%** of phrases. With the swap a Flourish is in
50.0% of opening hands, shared flair rises to 78–96%, and the two cuerpo horn cards
stop being dead (counts 3 and 7 fire in 50% and 45% of games, from 0.0%). The
opening-hand integers were recomputed by enumerating every starting hand, not
estimated: 88.6% of opening hands can open the floor and 7.1% hold no Position at all,
so the §4 mulligan still does the work it was added for.

The over-correction is recorded rather than tuned away: at 78–96% the Shared flair
bonus is nearly a participation prize again, and no number in the content moves that
rate — the rate is set by a Flourish being in half of all opening hands and by four
song cards paying for one. If the couch gate agrees it has stopped being a decision,
the cheap answer is `phraseBonuses.sharedFlair` back to 1, which is a JSON-only
change.

## 2026-10-23 — Private lessons go on top of the draw pile

A private lesson (Intermediate or Advanced) goes on **top** of the buyer's draw pile —
you just learned it, and you dance it next turn. A Beginner group class still goes to
the discard pile, and so does a Move copied from a partner. The destinations are
content, per tier (`rules.lessonToDrawTop`).

Reason: the measured baseline never bought a private lesson at all — 0.00 per game for
the greedy policy. A card bought at $2 or $3 that resurfaces an unknown number of turns
later cannot compete with a $1 Move in a 16-8-count song, so the whole lessons module
collapsed to buying the cheapest Move every turn: the best deck beat that strategy by
2.2%. Learning it for next turn is both the stronger play and the truer fiction, and
the best deck now beats $1-spam by 11.1%.

## 2026-10-23 — Ponche (`flo_005`), a Beginner Pose worth no Style

Ponche is a new Beginner Flourish: any position, **0 Style**, **Pose**, $1 from the
Beginner supply, 2 copies in the physical prototype. It scores nothing itself — it
makes the 8-count a pose, which is what the pose finish bonus and song card 16's first
branch look for.

Basis, with the conceit named: ponche is attested in
`research/salsa-dance-positions-moves-footwork-and-flourishes.md` as a phrase-ending
accent dancers mark on beat 8, and the source attributes it to **Cuban timba**. Clave's
one song is Oscar D'León's 1975 _Llorarás_ — salsa dura — so the card is admitted here
**by analogy**: a timba phrase-marker standing in for the full stop this arrangement
plainly has. Its `any` position tag follows the reasoning the 2026-07-19 veracity audit
used for the Arm Overheads, and deliberately not the one it used for Dip, which stays
Closed-only.

0 Style is a balance decision. At 1 Style the card would have matched Hand Twist's
tier, price and Style with strictly wider positions and the Pose flag — strictly
dominating the card this same change puts in the starter. At 0 it buys the finish, not
the points. The measured rate, against a baseline of **1.2%** of phrases, is **24–35%** of final
phrases for a pair that buys Ponche in time: it is a $1 group class, so it lands in the
discard pile and has to cycle back, which makes the finish a draw to plan for rather
than a certainty. Whether that is now too hard instead is a question for the couch
gate, not the simulator.

## 2026-10-23 — The montuno gets louder: the song-deck retune

Starting values for this change (the full table lives in `docs/cards/v1-card-list.md`,
where they are easy to re-tune): the two cuerpo horn cards, counts 3 and 7, fall to +1
Style. The montuno rises — count 9 to +1 Style and +1 Connection, count 10 to +4, 11 to
+6, 12 to +4, 13 to +3 Style and +1 Connection, 14 to +4, and 16 to +7 for a Pose or +3
for a Flourish. Count 15, "Response", now reads "+4 Style if you answer the call
standing over you", the one new condition op (`answeredCall`). Every song card except
counts 8 and 16 prints a favoured call, and the phrase-end pose finish bonus rises from
+3 to +4. Counts 1–7's favoured calls must be answerable from the starter deck — a
content test enforces it, so the song can never instruct a new pair into a guaranteed
Connection loss.

Reason: the crescendo was in the song's structure but not in its numbers. Measured,
phrase-2 Style was 1.24× phrase 1, no bonus paid more than +2, and five of the sixteen
cards fired in 0.0–0.6% of games — count 3 was impossible to satisfy in any game at
all. About 80% of an 8-count's Style is the cards in hand, which do not improve 1.5×
between phrases, so the only lever is the ~20% the song controls. After the retune,
song-bonus Style goes from 2.5 in the cuerpo to 12.1 in the montuno (4.8×), phrase 2
reaches 1.62× phrase 1 with calling turned off, count 16 becomes the biggest 8-count in
the song (4.6 Style against a next-best 4.4 on count 12), and 13 of 16 bonuses fire in
at least 15% of games — count 3 from 0.0% to 50%. The horn cards fall rather than rise
because the starter's new Flourish would otherwise lift phrase 1 and flatten the very
curve this is building. Count 11 is +6 rather than +5 for the same reason Show me
something is 8: a Move worth 3+ Style only exists on an Intermediate or Advanced card,
so this card and that call are the two clauses a $1-spam deck can never satisfy, and
together they are what makes the best deck beat it by 11.1%. Two counts still miss:
count 4 fires in 2% of games and count 9 in 14%, and raising what they pay moves
neither (count 4 measures 2% at +1, +2, +3 and +4) — both are limited by what a
four-card hand can reach, not by what the card pays.

## 2026-10-23 — The rating ladder re-fit

The rating minima are **0 / 36 / 50 / 60 / 70 / 82**. The six names and their lines are
unchanged.

Reason: the old ladder (0/20/30/40/50/60) was fitted to a game whose competent scores
clustered at 42–43, which is why 76% of games were Crowd Favorites and Soneros of the
Floor was reached 0.0% of the time. Against 1,482 completed games from four
plausible-human policies on the new rules (min 27, p10 49, median 65, p90 87) the old
minima put a third of the games in one band with only three of six bands reached often
at all. The re-fit measures 0.5 / 11.1 / 21.1 / 29.1 / 23.2 / 15.0% — no band over 40%,
five bands over 8%, and the top band still an achievement at 15.0%, with a 7.4% loss
tail that carries no rating at all.

## 2026-10-23 — Reset turn restores the call as it stood

"Reset turn" (UNDO_TURN) restores the whole 8-count, including both halves of the call:
the call the player made is un-made, and the call that stood over them comes back from
the turn checkpoint rather than being cleared, with afinque and Connection rewound to
match. A call is public state, so nothing is hidden by restoring it — and a reset that
forgot the partner's ask would hand the resetting player a free answer.

Reason: the checkpoint is the only record of the pre-turn call, and it is maintained by
hand in four places, so the undo walk (4,738 states) checks both halves explicitly.
