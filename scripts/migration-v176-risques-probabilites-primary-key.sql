-- Migration v176 : Ajouter une cle primaire metier a risques_probabilites
--
-- Cle primaire conseillee : (code_risque, periode, code_indicateur)
--
-- Note :
--  - Cette migration force code_indicateur non nul (via v175) avant de poser la PK.
--  - Si une PK existe deja sur la colonne id, elle sera remplacee.
--  - La colonne id est conservee et rendue UNIQUE pour compatibilite API.

BEGIN;

-- 1) Normaliser code_indicateur (au cas ou v175 n'a pas ete execute)
UPDATE risques_probabilites
SET code_indicateur = 'QUALI'
WHERE code_indicateur IS NULL
   OR btrim(code_indicateur) = '';

-- 2) Dedoublonnage sur la cle cible (garde la ligne la plus recente)
WITH ranked AS (
  SELECT
    ctid,
    ROW_NUMBER() OVER (
      PARTITION BY code_risque, periode, code_indicateur
      ORDER BY date_modification DESC NULLS LAST
    ) AS rn
  FROM risques_probabilites
  WHERE code_risque IS NOT NULL
    AND periode IS NOT NULL
    AND code_indicateur IS NOT NULL
)
DELETE FROM risques_probabilites r
USING ranked rk
WHERE r.ctid = rk.ctid
  AND rk.rn > 1;

-- 3) Colonnes NOT NULL (obligatoire pour PK)
ALTER TABLE risques_probabilites
  ALTER COLUMN code_risque SET NOT NULL,
  ALTER COLUMN periode SET NOT NULL,
  ALTER COLUMN code_indicateur SET NOT NULL;

-- 4) Garantir l'existence de la colonne id pour les routes qui suppriment par id
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'risques_probabilites'
      AND column_name = 'id'
  ) THEN
    CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
    ALTER TABLE risques_probabilites
      ADD COLUMN id UUID DEFAULT uuid_generate_v4();
  END IF;
END $$;

-- 5) Supprimer PK existante
ALTER TABLE risques_probabilites
  DROP CONSTRAINT IF EXISTS risques_probabilites_pkey;

-- 6) Ajouter la PK composite
ALTER TABLE risques_probabilites
  ADD CONSTRAINT risques_probabilites_pkey
  PRIMARY KEY (code_risque, periode, code_indicateur);

-- 7) Conserver id unique (compat API)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint c
    JOIN pg_class t ON t.oid = c.conrelid
    WHERE t.relname = 'risques_probabilites'
      AND c.contype = 'u'
      AND pg_get_constraintdef(c.oid) ILIKE '%UNIQUE (id)%'
  ) THEN
    ALTER TABLE risques_probabilites
      ADD CONSTRAINT risques_probabilites_id_key UNIQUE (id);
  END IF;
END $$;

COMMIT;
