-- Migration v187 (2026-01-24)
-- 1) Drop: code_indicateur, libelle_indicateur, valeur_indicateur, ind_obtenu
-- 2) UNIQUE => (code_risque, periode, archive)

BEGIN;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema='public' AND table_name='risques_probabilites'
  ) THEN
    RAISE NOTICE 'Table public.risques_probabilites introuvable - migration ignorée.';
    RETURN;
  END IF;
END $$;

ALTER TABLE public.risques_probabilites
  DROP COLUMN IF EXISTS code_indicateur,
  DROP COLUMN IF EXISTS libelle_indicateur,
  DROP COLUMN IF EXISTS valeur_indicateur,
  DROP COLUMN IF EXISTS ind_obtenu;

DROP TRIGGER IF EXISTS trg_rp_force_code_indicateur ON public.risques_probabilites;
DROP FUNCTION IF EXISTS public.rp_force_code_indicateur();

DO $$
DECLARE r RECORD;
BEGIN
  FOR r IN (
    SELECT c.conname
    FROM pg_constraint c
    JOIN pg_class t ON t.oid = c.conrelid
    WHERE t.relname = 'risques_probabilites'
      AND c.contype = 'u'
      AND pg_get_constraintdef(c.oid) ILIKE '%code_indicateur%'
  ) LOOP
    EXECUTE format('ALTER TABLE public.risques_probabilites DROP CONSTRAINT IF EXISTS %I', r.conname);
  END LOOP;
END $$;

ALTER TABLE public.risques_probabilites
  ADD COLUMN IF NOT EXISTS archive VARCHAR(3) DEFAULT 'Non';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint c
    JOIN pg_class t ON t.oid = c.conrelid
    WHERE t.relname = 'risques_probabilites'
      AND c.contype = 'u'
      AND pg_get_constraintdef(c.oid) ILIKE '%UNIQUE (code_risque, periode, archive)%'
  ) THEN
    ALTER TABLE public.risques_probabilites
      ADD CONSTRAINT risques_probabilites_code_risque_periode_archive_key
      UNIQUE (code_risque, periode, archive);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_risques_probabilites_archive ON public.risques_probabilites(archive);

COMMIT;
