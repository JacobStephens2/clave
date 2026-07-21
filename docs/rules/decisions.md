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
