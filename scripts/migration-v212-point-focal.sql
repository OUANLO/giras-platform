-- GIRAS v212 — Exécuter AVANT de déployer le code Point focal.
-- Idempotent ; ne modifie pas les habilitations des comptes existants.
DO $$
DECLARE typ record;
BEGIN
  SELECT t.typname, n.nspname INTO typ
  FROM pg_attribute a JOIN pg_type t ON t.oid = a.atttypid
  JOIN pg_namespace n ON n.oid = t.typnamespace
  WHERE a.attrelid = 'public.users'::regclass AND a.attname = 'type_utilisateur' AND t.typtype = 'e';
  IF FOUND THEN EXECUTE format('ALTER TYPE %I.%I ADD VALUE IF NOT EXISTS %L', typ.nspname, typ.typname, 'Point focal'); END IF;
END $$;

ALTER TABLE public.users ADD COLUMN IF NOT EXISTS structures_point_focal jsonb NOT NULL DEFAULT '[]'::jsonb;

-- Élargir uniquement une éventuelle contrainte CHECK du type de compte.
DO $$
DECLARE c record;
BEGIN
  FOR c IN SELECT conname, pg_get_expr(conbin, conrelid) AS expression
    FROM pg_constraint WHERE conrelid = 'public.users'::regclass AND contype = 'c'
    AND conkey = ARRAY[(SELECT attnum FROM pg_attribute WHERE attrelid = 'public.users'::regclass AND attname = 'type_utilisateur')]::smallint[]
  LOOP
    IF position('Point focal' in c.expression) = 0 THEN
      EXECUTE format('ALTER TABLE public.users DROP CONSTRAINT %I', c.conname);
      EXECUTE format('ALTER TABLE public.users ADD CONSTRAINT %I CHECK ((%s) OR type_utilisateur::text = %L)', c.conname, c.expression, 'Point focal');
    END IF;
  END LOOP;
END $$;

CREATE OR REPLACE FUNCTION public.validate_point_focal_structures() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF jsonb_typeof(NEW.structures_point_focal) <> 'array' THEN
    RAISE EXCEPTION 'Les structures du point focal doivent être une liste';
  END IF;
  IF NEW.type_utilisateur::text = 'Point focal' THEN
    IF jsonb_array_length(NEW.structures_point_focal) = 0 THEN
      RAISE EXCEPTION 'Au moins une structure est obligatoire pour un point focal';
    END IF;
    IF EXISTS (
      SELECT 1 FROM jsonb_array_elements_text(NEW.structures_point_focal) AS selected(code)
      WHERE NOT EXISTS (SELECT 1 FROM public.structures s WHERE s.code_structure::text = selected.code)
    ) THEN RAISE EXCEPTION 'Structure du point focal inconnue'; END IF;
  ELSE
    NEW.structures_point_focal := '[]'::jsonb;
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS validate_point_focal_structures ON public.users;
CREATE TRIGGER validate_point_focal_structures BEFORE INSERT OR UPDATE OF type_utilisateur, structures_point_focal ON public.users
FOR EACH ROW EXECUTE FUNCTION public.validate_point_focal_structures();
