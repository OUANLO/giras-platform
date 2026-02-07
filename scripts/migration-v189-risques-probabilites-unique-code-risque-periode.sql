-- Migration v189 (2026-01-24)
--
-- Exigence:
-- - Pour une période donnée, un risque ne doit avoir qu'un seul enregistrement dans risques_probabilites.
-- - La clé UNIQUE doit donc être formée de (code_risque, periode).
--
-- Notes:
-- - On conserve la colonne `archive` si elle existe (état Oui/Non), mais elle ne participe plus à l'unicité.
-- - Avant d'ajouter la contrainte, on supprime les doublons éventuels en gardant la "meilleure" ligne.

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

-- 1) Dédoublonnage: garder 1 ligne par (code_risque, periode)
-- Priorité de conservation:
--   1) archive='Non' (si présent)
--   2) date_modification la plus récente (si présent)
--   3) date_saisie la plus récente (si présent)
--   4) id le plus grand (si présent)
DO $$
DECLARE
  has_archive boolean;
  has_date_modification boolean;
  has_date_saisie boolean;
  has_id boolean;
BEGIN
  SELECT EXISTS(
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='risques_probabilites' AND column_name='archive'
  ) INTO has_archive;

  SELECT EXISTS(
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='risques_probabilites' AND column_name='date_modification'
  ) INTO has_date_modification;

  SELECT EXISTS(
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='risques_probabilites' AND column_name='date_saisie'
  ) INTO has_date_saisie;

  SELECT EXISTS(
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='risques_probabilites' AND column_name='id'
  ) INTO has_id;

  -- Construire dynamiquement l'ORDER BY selon les colonnes disponibles
  EXECUTE (
    'WITH ranked AS (\n'
    || '  SELECT ctid AS _ctid, code_risque, periode,\n'
    || '         ROW_NUMBER() OVER (\n'
    || '           PARTITION BY code_risque, periode\n'
    || '           ORDER BY '
    || (CASE WHEN has_archive THEN 'CASE WHEN archive=''Non'' THEN 0 ELSE 1 END, ' ELSE '' END)
    || (CASE WHEN has_date_modification THEN 'date_modification DESC NULLS LAST, ' ELSE '' END)
    || (CASE WHEN has_date_saisie THEN 'date_saisie DESC NULLS LAST, ' ELSE '' END)
    || (CASE WHEN has_id THEN 'id DESC NULLS LAST, ' ELSE '' END)
    || 'ctid DESC\n'
    || '         ) AS rn\n'
    || '  FROM public.risques_probabilites\n'
    || ')\n'
    || 'DELETE FROM public.risques_probabilites rp\n'
    || 'USING ranked r\n'
    || 'WHERE rp.ctid = r._ctid AND r.rn > 1;'
  );
END $$;

-- 2) Supprimer toute contrainte UNIQUE existante qui pourrait bloquer la nouvelle
DO $$
DECLARE r RECORD;
BEGIN
  FOR r IN (
    SELECT c.conname
    FROM pg_constraint c
    JOIN pg_class t ON t.oid = c.conrelid
    WHERE t.relname = 'risques_probabilites'
      AND c.contype = 'u'
  ) LOOP
    EXECUTE format('ALTER TABLE public.risques_probabilites DROP CONSTRAINT IF EXISTS %I', r.conname);
  END LOOP;
END $$;

-- 3) Ajouter la nouvelle contrainte UNIQUE (code_risque, periode)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint c
    JOIN pg_class t ON t.oid = c.conrelid
    WHERE t.relname = 'risques_probabilites'
      AND c.contype = 'u'
      AND pg_get_constraintdef(c.oid) ILIKE '%UNIQUE (code_risque, periode)%'
  ) THEN
    ALTER TABLE public.risques_probabilites
      ADD CONSTRAINT risques_probabilites_code_risque_periode_key
      UNIQUE (code_risque, periode);
  END IF;
END $$;

COMMIT;
