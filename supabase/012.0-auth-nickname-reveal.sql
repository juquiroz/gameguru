-- ============================================================================
-- BUILD-AUTH-NICK-001 — Auth Google + nickname POR LIGA + finalizar/revelar
-- Script MANUAL: ejecutar en el SQL Editor de Supabase (Dashboard > SQL).
-- Idempotente: puede ejecutarse varias veces sin errores ni duplicados.
--
-- Alcance (PLAN v2 aprobado):
--   1) `profiles.real_name` / `profiles.avatar_url` → identidad REAL global y
--      PRIVADA. Nunca se muestra salvo cuando la liga terminó y el admin
--      reveló nombres (`leagues.finished && leagues.revealed`); ni siquiera la
--      consola de plataforma la expone.
--   2) `league_members.nickname` → identidad PÚBLICA POR LIGA (cada usuario
--      elige un nick distinto en cada liga). Es INMUTABLE una vez fijado:
--      un trigger bloquea cualquier UPDATE sobre la columna.
--   3) Unicidad por liga: índice UNIQUE parcial (league_id, nickname) →
--      no se repite un nick DENTRO de la misma liga, pero el mismo usuario
--      puede reutilizar su nick en OTRAS ligas.
--   4) `leagues.finished` / `leagues.revealed` → ciclo de revelación admin:
--      "Finalizar liga" (finished=true) habilita "Revelar nombres"
--      (revealed=true, irreversible; solo si finished=true).
--   5) `handle_new_user` reescrito: la identidad real (`real_name`) se toma
--      SOLO de meta explícita (`real_name`/`realName`/`name`/`full_name`),
--      NUNCA del email (un correo como nombre real quedaría visible a todos
--      los jugadores tras el reveal); en Google usa name/full_name/avatar_url
--      de `raw_user_meta_data`. El username global solo se guarda si el
--      usuario lo escribió (nunca el prefijo del email).
--   6) Backfill de limpieza: se anulan real_name con apariencia de email y
--      usernames que repitan el prefijo del email (datos creados por el
--      fallback viejo).
--
-- Sin cambios en: scores, game_time, locking, picks, RLS de platform.
-- ============================================================================

-- ── 1) profiles: identidad real global (privada) ────────────────────────────
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS real_name  text,
  ADD COLUMN IF NOT EXISTS avatar_url text;

-- ── 2) league_members: nickname POR LIGA (identidad pública) ────────────────
ALTER TABLE public.league_members
  ADD COLUMN IF NOT EXISTS nickname text;

-- Unicidad del nickname DENTRO de una liga (reutilizable en otras ligas).
-- Parcial: no fuerza unicidad sobre filas legacy con nickname NULL.
CREATE UNIQUE INDEX IF NOT EXISTS league_members_nickname_per_league_key
  ON public.league_members (league_id, nickname)
  WHERE nickname IS NOT NULL;

-- Inmutabilidad del nickname a nivel de BD: un trigger rechaza cualquier
-- cambio sobre `nickname` una vez fijado (defensa en profundidad; la app
-- tampoco expone edición). Se permite la captura inicial (NULL→valor) para
-- usuarios legacy, pero una vez con nickname no puede cambiar. No bloquea
-- INSERT inicial ni UPDATEs de otras columnas (role, joined_at).
CREATE OR REPLACE FUNCTION public.protect_league_member_nickname()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF TG_OP = 'UPDATE'
     AND OLD.nickname IS NOT NULL
     AND NEW.nickname IS DISTINCT FROM OLD.nickname THEN
    RAISE EXCEPTION 'league_members.nickname es inmutable una vez fijado';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_protect_league_member_nickname ON public.league_members;
CREATE TRIGGER trg_protect_league_member_nickname
  BEFORE UPDATE OF nickname ON public.league_members
  FOR EACH ROW EXECUTE FUNCTION public.protect_league_member_nickname();

-- ── 3) leagues: ciclo de revelación admin ────────────────────────────────────
ALTER TABLE public.leagues
  ADD COLUMN IF NOT EXISTS finished boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS revealed boolean NOT NULL DEFAULT false;

-- Regla de dominio: solo se puede finalizar pasando de false a true (nunca
-- des-finalizar) y solo se puede revelar si la liga está finalizada.
CREATE OR REPLACE FUNCTION public.protect_league_reveal_lifecycle()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF TG_OP = 'UPDATE' THEN
    IF NEW.finished IS DISTINCT FROM OLD.finished AND NOT (OLD.finished = false AND NEW.finished = true) THEN
      RAISE EXCEPTION 'leagues.finished solo puede cambiar de false a true (irreversible)';
    END IF;
    IF NEW.revealed IS DISTINCT FROM OLD.revealed AND NOT (OLD.revealed = false AND NEW.revealed = true) THEN
      RAISE EXCEPTION 'leagues.revealed solo puede cambiar de false a true (irreversible)';
    END IF;
    IF NEW.revealed = true AND NEW.finished = false THEN
      RAISE EXCEPTION 'no se puede revelar nombres sin finalizar la liga';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_protect_league_reveal_lifecycle ON public.leagues;
CREATE TRIGGER trg_protect_league_reveal_lifecycle
  BEFORE UPDATE OF finished, revealed ON public.leagues
  FOR EACH ROW EXECUTE FUNCTION public.protect_league_reveal_lifecycle();

-- ── 5) handle_new_user: identidad real explícita (NUNCA email) ──────────────
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_meta jsonb := NEW.raw_user_meta_data;
  v_real_name text := NULL;
  v_avatar    text := NULL;
  v_username  text := NULL;
BEGIN
  -- Identidad real global SOLO desde datos explícitos del usuario. Nunca se
  -- deriva de NEW.email: un correo es contacto, no identidad, y quedaría
  -- expuesto a todos los jugadores cuando el admin revela la liga.
  v_real_name := COALESCE(
    NULLIF(v_meta ->> 'real_name', ''),
    NULLIF(v_meta ->> 'realName', ''),
    NULLIF(v_meta ->> 'name', ''),
    NULLIF(v_meta ->> 'full_name', '')
  );
  -- Neutralización defensiva: cualquier real_name con forma de email se anula.
  IF v_real_name IS NOT NULL AND v_real_name LIKE '%@%' THEN
    v_real_name := NULL;
  END IF;

  v_avatar := NULLIF(v_meta ->> 'avatar_url', NULLIF(v_meta ->> 'picture', ''));

  -- username global = SOLO si el usuario lo escribió explícitamente; nunca el
  -- prefijo de un email como identidad pública.
  v_username := NULLIF(v_meta ->> 'username', '');

  INSERT INTO public.profiles (id, username, real_name, avatar_url)
  VALUES (NEW.id, v_username, v_real_name, v_avatar)
  ON CONFLICT (id) DO UPDATE
    SET real_name  = COALESCE(EXCLUDED.real_name, public.profiles.real_name),
        avatar_url = COALESCE(EXCLUDED.avatar_url, public.profiles.avatar_url);
  RETURN NEW;
END;
$$;

-- ── 6) Backfill: limpieza de identidades tipo email ─────────────────────────
-- Datos creados por el fallback viejo (real_name = email, username = prefijo).
-- Un email jamás debe quedar como identidad; se anula para que nunca se
-- muestre a otros jugadores (ni en lists ni tras el reveal).
UPDATE public.profiles
   SET real_name = NULL
 WHERE real_name LIKE '%@%';

UPDATE public.profiles p
   SET username = NULL
  FROM auth.users u
 WHERE u.id = p.id
   AND p.username = split_part(u.email, '@', 1);
