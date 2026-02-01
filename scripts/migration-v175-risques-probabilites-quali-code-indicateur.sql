-- Migration v175 : Garantir code_indicateur non nul (cas des risques qualitatifs)
--
-- Objectif :
--  - Eviter les erreurs "null value in column code_indicateur violates not-null constraint"
--  - Rendre l'UPSERT stable (ON CONFLICT sur code_indicateur)
--
-- Regle : si code_indicateur est NULL ou vide => 'QUALI'

BEGIN;

-- 1) Normaliser les lignes existantes
UPDATE risques_probabilites
SET code_indicateur = 'QUALI'
WHERE code_indicateur IS NULL
   OR btrim(code_indicateur) = '';

-- 2) Valeur par defaut
ALTER TABLE risques_probabilites
  ALTER COLUMN code_indicateur SET DEFAULT 'QUALI';

-- 3) Trigger de securite (meme si le backend envoie NULL)
CREATE OR REPLACE FUNCTION rp_force_code_indicateur()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.code_indicateur IS NULL OR btrim(NEW.code_indicateur) = '' THEN
    NEW.code_indicateur := 'QUALI';
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_rp_force_code_indicateur ON risques_probabilites;

CREATE TRIGGER trg_rp_force_code_indicateur
BEFORE INSERT OR UPDATE ON risques_probabilites
FOR EACH ROW
EXECUTE FUNCTION rp_force_code_indicateur();

COMMIT;
