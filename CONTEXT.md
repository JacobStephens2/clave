# Clave

A cooperative two-player digital card game in which a Lead and a Follow salsa dance a song
together.

## Calling and answering

**Call**:
One of seven named asks a player makes as their dance step ends, in place of taking the
song card's bonus; it stands over the partner's next 8-count, where it is answered,
covered, or dropped. A call is content (`rules.call.options`, ids `call_001`–`call_007`),
never a card.
_Avoid_: ask, request, challenge, dare; "the call" for song card 14, which is itself
titled **Call** — say "song card 14" or "the Call card"

**Afinque**:
The calls the couple has answered in a row, counted in links and shared between both
players; each link pays the answer extra Style. It breaks to 0 on a dropped call, a
covered call, a stumble, or an 8-count with no Move, and resets at every phrase ending.
_Avoid_: streak, combo, multiplier, chain

**Hold**:
The position the couple is in, and the one play that changes it without a Move: taking
the hold on an empty floor, or adjusting the hold on an established one, before any
other card in the 8-count. Which of the two it was is recorded on the 8-count, as
`hold: "taken" | "adjusted"`, so a hold is never read back as the basic.
_Avoid_: frame, grip; transition (a transition is the Position played _after_ a Move);
"hold" for a held, staged, or paused card

**Rung**:
The one label every 8-count ends on — perfect, clean, awkward, recovered, or break —
recorded on the 8-count's history entry beside the older `outcome` field.
_Avoid_: outcome, grade, result; the clean **rung** for the **Clean phrase** bonus (the
rung is one 8-count, the bonus is a whole phrase)

## Games and their storage

**Room**:
A two-device game the server holds under a room code, with one seat for the Lead and one for
the Follow.
_Avoid_: lobby, session

**Hot-seat game**:
A game played on one device, passed between the players, and saved in that browser.
_Avoid_: local game, offline game

**Resume envelope**:
Everything persisted for one game, kept together for its life: engine version, content bytes and
their hash, seed, live action log and latest state, plus the replay origin and retired logs once
rehydration has changed it.
_Avoid_: save, snapshot

**Snapshot**:
One role's view of a game, with the partner's hand and every deck order hidden.
_Avoid_: using "snapshot" for the envelope's stored state

**Rehydration**:
Turning a stored resume envelope back into a live one under the running engine; the stored state
decides and the action log only verifies it.
_Avoid_: load, restore (a restore brings back a database backup)

**Replay origin**:
The state an envelope's live action log replays from: a new game built from the seed, or the
state rehydration last resumed from.
_Avoid_: baseline, checkpoint (a checkpoint is the turn-start state that undo returns to)

**Retired log**:
An action log kept verbatim in a resume envelope and never replayed again, with the engine
version it ran under and why it was retired: pre-upgrade, replay mismatch, or unresumable.

**Unresumable**:
The ending of a game whose stored envelope the running release cannot safely resume.
_Avoid_: corrupted, lost (a lost game is one whose Connection reached 0)
