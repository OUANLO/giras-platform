-- Migration v173 : Contrainte UNIQUE pour l'UPSERT risques_probabilites
--
-- Contexte:
--   L'application enregistre/met à jour la "photographie" d'une ligne d'analyse
--   via un UPSERT:
--     ON CONFLICT (code_risque, periode, code_indicateur) DO UPDATE
--   PostgreSQL exige une contrainte UNIQUE/EXCLUDE EXACTEMENT sur ces colonnes.
--
-- Cette migration :
--  1) Nettoie les doublons sur (code_risque, periode, code_indicateur)
--     en conservant la ligne la plus récente (date_modification DESC).
--  2) Remplace (si elle existe) une contrainte UNIQUE trop restrictive sur
--     (code_risque, periode) par une contrainte UNIQUE sur
--     (code_risque, periode, code_indicateur).

BEGIN;

-- 1) Dédoublonnage (si la table existe)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema='public' AND table_name='risques_probabilites'
  ) THEN
    -- Supprimer les doublons stricts sur la clé cible en gardant la plus récente
    WITH ranked AS (
      SELECT
        ctid,
        code_risque,
        periode,
        code_indicateur,
        ROW_NUMBER() OVER (
          PARTITION BY code_risque, periode, code_indicateur
          ORDER BY date_modification DESC NULLS LAST
        ) AS rn
      FROM risques_probabilites
      WHERE code_risque IS NOT NULL
        AND periode IS NOT NULL
        AND code_indicateur IS NOT NULL
    )
    DELETE FROM risques_probabilites rp
    USING ranked r
    WHERE rp.ctid = r.ctid
      AND r.rn > 1;
  END IF;
END $$;

-- 2) Supprimer toute contrainte UNIQUE existante sur (code_risque, periode)
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN (
    SELECT c.conname
    FROM pg_constraint c
    JOIN pg_class t ON t.oid = c.conrelid
    WHERE t.relname = 'risques_probabilites'
      AND c.contype = 'u'
      AND pg_get_constraintdef(c.oid) ILIKE '%UNIQUE (code_risque, periode)%'
      AND pg_get_constraintdef(c.oid) NOT ILIKE '%code_indicateur%'
  ) LOOP
    EXECUTE format('ALTER TABLE risques_probabilites DROP CONSTRAINT IF EXISTS %I', r.conname);
  END LOOP;
END $$;

-- 3) Ajouter la contrainte UNIQUE attendue par l'UPSERT
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint c
    JOIN pg_class t ON t.oid = c.conrelid
    WHERE t.relname = 'risques_probabilites'
      AND c.contype = 'u'
      AND pg_get_constraintdef(c.oid) ILIKE '%UNIQUE (code_risque, periode, code_indicateur)%'
  ) THEN
    ALTER TABLE risques_probabilites
      ADD CONSTRAINT risques_probabilites_code_risque_periode_ind_key
      UNIQUE (code_risque, periode, code_indicateur);
  END IF;
END $$;

COMMIT;
