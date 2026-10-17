# Rehydration retires action logs it will not replay

When rehydration resumes a game from its stored state instead of from its log - after an engine
upgrade, after a replay mismatch, or when it declares the game unresumable - that state becomes
the envelope's replay origin, the old log is retired verbatim with its engine version and
reason, and the live log starts empty. Later rehydrations replay only the live log from that
origin, so the per-room determinism check (NFR-4) keeps working after an upgrade, an old log is
never read with a newer action schema, and a mismatch is reported once instead of on every
restart. We accepted one extra copy of the game state in each such envelope (a few KB) over the
alternatives: marking an old log without an origin would end verification for every upgraded
room, and re-reporting a mismatch on every restart would raise an alarm that never clears.
