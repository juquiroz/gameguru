-- Saneamiento de scores pre-kickoff (0-0 persistido por ESPN para juegos sin
-- iniciar). La UI mostraba "0 – 0" en semanas abiertas por datos corruptos:
-- normalize() persistía los scores que ESPN manda ('0' o '') para partidos
-- STATUS_SCHEDULED/PRE_GAME. El fix de fuente vive en
-- `supabase/functions/_shared/espn-nfl.ts` (scores solo si final/live); esta
-- migración limpia lo ya persistido.
-- Targeted: solo el patrón exacto (0, 0) con finished=false — no toca juegos
-- finalizados ni en vivo con scores reales.

BEGIN;

UPDATE master_games
SET home_score = NULL, away_score = NULL
WHERE finished = false
  AND home_score = 0
  AND away_score = 0;

UPDATE league_games
SET home_score = NULL, away_score = NULL
WHERE finished = false
  AND home_score = 0
  AND away_score = 0;

COMMIT;