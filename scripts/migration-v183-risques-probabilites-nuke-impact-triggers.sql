-- Migration v183: nettoyage agressif des triggers/fonctions legacy
-- But: eliminer toute reference a impact_brut/impact_net/score_/criticite_ sur risques_probabilites.

BEGIN;

-- 1) Supprimer tous les triggers utilisateur sur risques_probabilites
DO $$
DECLARE r record;
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'risques_probabilites'
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

-- 2) Supprimer toutes les fonctions public qui contiennent des mots-cles legacy
DO $$
DECLARE f record;
DECLARE kw text;
BEGIN
  FOREACH kw IN ARRAY ARRAY[
    'impact_brut','impact_net','score_brut','score_net',
    'criticite_brute','criticite_nette','niveau_criticite_brute','niveau_criticite_nette'
  ]
  LOOP
    FOR f IN
      SELECT p.oid, n.nspname, p.proname,
             pg_get_function_identity_arguments(p.oid) AS args
      FROM pg_proc p
      JOIN pg_namespace n ON n.oid = p.pronamespace
      WHERE n.nspname = 'public'
        AND p.prosrc ILIKE ('%' || kw || '%')
    LOOP
      EXECUTE format('DROP FUNCTION IF EXISTS %I.%I(%s) CASCADE', f.nspname, f.proname, f.args);
    END LOOP;
  END LOOP;
END $$;

-- 3) Re-creer un trigger minimal compatible
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
