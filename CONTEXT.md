# Clave

A cooperative two-player digital card game in which a Lead and a Follow salsa dance a song
together.

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
