-- SM-1: completed games in the first four weeks (bind :window_start / :window_end).
SELECT COUNT(*) AS completed_games
FROM game_events
WHERE type = 'completed'
  AND test = 0
  AND occurred_at >= :window_start
  AND occurred_at < :window_end;

-- SM-2: terminal classification and completion rate for started online games.
WITH started AS (
  SELECT room_code
  FROM game_events
  WHERE type = 'game_started' AND test = 0
    AND occurred_at >= :window_start AND occurred_at < :window_end
), terminal AS (
  SELECT room_code, type
  FROM game_events
  WHERE type IN ('completed', 'lost', 'abandoned', 'unresumable') AND test = 0
)
SELECT
  COUNT(started.room_code) AS games_started,
  SUM(CASE WHEN terminal.type IN ('completed', 'lost') THEN 1 ELSE 0 END) AS rules_defined_endings,
  ROUND(100.0 * SUM(CASE WHEN terminal.type IN ('completed', 'lost') THEN 1 ELSE 0 END)
    / NULLIF(COUNT(started.room_code), 0), 1) AS completion_rate_percent
FROM started
LEFT JOIN terminal USING (room_code);
