-- Migration v182 : supprimer les triggers legacy incompatibles (colonnes supprimées)
--
-- Symptôme : "record NEW has no field impact_brut" / "impact_net" / "score_*" / "criticite_*".
-- Cause : des fonctions/trigger PL/pgSQL hérités qui utilisent des colonnes supprimées.
--
-- Cette migration :
-- 1) supprime tous les triggers utilisateur sur risques_probabilites
-- 2) supprime quelques fonctions legacy (si présentes)
-- 3) recrée un seul trigger minimal compatible avec le schéma allégé

BEGIN;

-- A) supprimer TOUS les triggers utilisateur sur la table (on repart clean)
DO $$
DECLARE r record;
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema='public' AND table_name='risques_probabilites'
  ) THEN
    FOR r IN
      SELECT t.tgname
      FROM pg_trigger t
      JOIN pg_class c ON c.oid = t.tgrelid
      WHERE c.relname = 'risques_probabilites'
        AND NOT t.tgisinternal
    LOOP
      EXECUTE format('DROP TRIGGER IF EXISTS %I ON risques_probabilites', r.tgname);
    END LOOP;
  END IF;
END $$;

-- B) supprimer les fonctions legacy connues si elles existent
DROP FUNCTION IF EXISTS rp_compute_fields() CASCADE;
DROP FUNCTION IF EXISTS rp_compute_scores() CASCADE;
DROP FUNCTION IF EXISTS rp_force_code_indicateur() CASCADE;
DROP FUNCTION IF EXISTS rp_minimal_guard() CASCADE;
DROP FUNCTION IF EXISTS rp_guard_minimal() CASCADE;

-- C) recréer un trigger minimal compatible
CREATE OR REPLACE FUNCTION rp_guard_minimal()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  -- date de modification
  NEW.date_modification := NOW();

  -- code_indicateur obligatoire (QUALI si vide/null)
  IF NEW.code_indicateur IS NULL OR btrim(NEW.code_indicateur) = '' THEN
    NEW.code_indicateur := 'QUALI';
  END IF;

  -- archive par défaut (Oui/Non)
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
