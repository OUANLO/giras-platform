BEGIN;

-- Supprimer le trigger legacy qui référence encore des colonnes supprimées (impact_brut, etc.)
DROP TRIGGER IF EXISTS trg_rp_compute_fields ON risques_probabilites;

-- Supprimer la fonction legacy associée si elle existe
DROP FUNCTION IF EXISTS rp_compute_fields() CASCADE;
DROP FUNCTION IF EXISTS rp_compute_scores() CASCADE;
DROP FUNCTION IF EXISTS rp_force_code_indicateur() CASCADE;

-- Créer/maintenir un trigger minimal compatible avec la table allégée
CREATE OR REPLACE FUNCTION rp_guard_minimal()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.date_modification := NOW();

  IF NEW.code_indicateur IS NULL OR btrim(NEW.code_indicateur) = '' THEN
    NEW.code_indicateur := 'QUALI';
  END IF;

  IF NEW.archive IS NULL OR btrim(NEW.archive) = '' THEN
    NEW.archive := 'Non';
  END IF;

  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_rp_guard_minimal ON risques_probabilites;

CREATE TRIGGER trg_rp_guard_minimal
BEFORE INSERT OR UPDATE ON risques_probabilites
FOR EACH ROW
EXECUTE FUNCTION rp_guard_minimal();

COMMIT;
