-- Migration v185
-- Objectif:
-- 1) Supprimer les colonnes legacy `probabilite` et `code_risque` de `indicateur_occurrences`.
--    La probabilité est désormais la source de vérité dans `risques_probabilites`.

DO $$
BEGIN
  -- Table absente ? (environnements hétérogènes)
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name = 'indicateur_occurrences'
  ) THEN
    RAISE NOTICE 'Table public.indicateur_occurrences introuvable - migration ignorée.';
    RETURN;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'indicateur_occurrences'
      AND column_name = 'probabilite'
  ) THEN
    ALTER TABLE public.indicateur_occurrences DROP COLUMN probabilite;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'indicateur_occurrences'
      AND column_name = 'code_risque'
  ) THEN
    ALTER TABLE public.indicateur_occurrences DROP COLUMN code_risque;
  END IF;
END $$;

-- Nettoyage opportuniste d'index éventuels (selon les environnements)
DROP INDEX IF EXISTS public.indicateur_occurrences_code_risque_idx;
DROP INDEX IF EXISTS public.idx_indicateur_occurrences_code_risque;
DROP INDEX IF EXISTS public.indicateur_occurrences_probabilite_idx;
DROP INDEX IF EXISTS public.idx_indicateur_occurrences_probabilite;
