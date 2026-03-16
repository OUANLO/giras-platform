-- Migration v197
-- Objectif: garantir qu'il n'existe jamais de ligne dans risques_probabilites avec probabilite vide.

BEGIN;

-- 1) Nettoyage: supprimer les lignes déjà invalides
DELETE FROM public.risques_probabilites
WHERE probabilite IS NULL OR btrim(probabilite::text) = '';

-- 2) Tenter de rendre la colonne NOT NULL (si possible)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='risques_probabilites' AND column_name='probabilite'
  ) THEN
    BEGIN
      EXECUTE 'ALTER TABLE public.risques_probabilites ALTER COLUMN probabilite SET NOT NULL';
    EXCEPTION WHEN others THEN
      -- Dans certains environnements, le type ou des lignes invalides peuvent empêcher cette opération.
      -- La contrainte CHECK ci-dessous garantit quand même l''absence de valeur vide.
      RAISE NOTICE 'Impossible de forcer probabilite NOT NULL: %', SQLERRM;
    END;
  END IF;
END $$;

-- 3) Contrainte CHECK: probabilite ne peut pas être vide
ALTER TABLE public.risques_probabilites
  DROP CONSTRAINT IF EXISTS risques_probabilites_probabilite_non_vide;

ALTER TABLE public.risques_probabilites
  ADD CONSTRAINT risques_probabilites_probabilite_non_vide
  CHECK (btrim(probabilite::text) <> '');

COMMIT;
