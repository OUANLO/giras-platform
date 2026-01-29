-- Migration v172 : Alignement du schéma risques_probabilites avec le besoin "snapshot Analyse"
--
-- Changements demandés :
-- 1) Supprimer les colonnes devenues inutiles :
--    - code_periode, libelle_periode, raison_archive, fichier_cartographie_url
-- 2) Aligner certains types sur les valeurs affichées en UI :
--    - qualitatif : 'Oui' | 'Non' (au lieu de booléen)
--    - archive : 'Oui' | 'Non' (au lieu de booléen)

BEGIN;

-- 1) Suppression des colonnes
ALTER TABLE risques_probabilites
  DROP COLUMN IF EXISTS code_periode,
  DROP COLUMN IF EXISTS libelle_periode,
  DROP COLUMN IF EXISTS raison_archive,
  DROP COLUMN IF EXISTS fichier_cartographie_url;

-- Index devenu obsolète
DROP INDEX IF EXISTS idx_risques_probabilites_code_periode;

-- 2) Conversion de types : qualitatif (BOOLEAN -> VARCHAR)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name='risques_probabilites'
      AND column_name='qualitatif'
      AND data_type='boolean'
  ) THEN
    EXECUTE $$
      ALTER TABLE risques_probabilites
      ALTER COLUMN qualitatif TYPE VARCHAR(3)
      USING (CASE WHEN qualitatif IS TRUE THEN 'Oui' ELSE 'Non' END)
    $$;

    -- Contrainte (si compatible avec votre environnement)
    BEGIN
      EXECUTE $$
        ALTER TABLE risques_probabilites
        ADD CONSTRAINT risques_probabilites_qualitatif_check
        CHECK (qualitatif IN ('Oui','Non'))
      $$;
    EXCEPTION WHEN duplicate_object THEN
      -- déjà présente
      NULL;
    END;
  END IF;
END $$;

-- 3) Conversion de types : archive (BOOLEAN -> VARCHAR)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name='risques_probabilites'
      AND column_name='archive'
      AND data_type='boolean'
  ) THEN
    EXECUTE $$
      ALTER TABLE risques_probabilites
      ALTER COLUMN archive TYPE VARCHAR(3)
      USING (CASE WHEN archive IS TRUE THEN 'Oui' ELSE 'Non' END)
    $$;

    EXECUTE $$
      ALTER TABLE risques_probabilites
      ALTER COLUMN archive SET DEFAULT 'Non'
    $$;

    BEGIN
      EXECUTE $$
        ALTER TABLE risques_probabilites
        ADD CONSTRAINT risques_probabilites_archive_check
        CHECK (archive IN ('Oui','Non'))
      $$;
    EXCEPTION WHEN duplicate_object THEN
      NULL;
    END;
  END IF;
END $$;

-- Index utile (reste valable avec VARCHAR)
CREATE INDEX IF NOT EXISTS idx_risques_probabilites_archive ON risques_probabilites(archive);

COMMIT;
