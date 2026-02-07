-- Migration v188 (2026-01-24)
-- Après suppression des colonnes code_risque/probabilite (v185/v186),
-- l'index unique historique pouvait encore référencer code_risque.
-- Cette migration reconstruit un index unique compatible.

BEGIN;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema='public' AND table_name='indicateur_occurrences'
  ) THEN
    RAISE NOTICE 'Table public.indicateur_occurrences introuvable - migration ignorée.';
    RETURN;
  END IF;
END $$;

-- Supprimer l'index unique legacy si présent (nom connu du setup initial)
DROP INDEX IF EXISTS public.idx_indicateur_occurrences_unique;

-- Recréer un index unique sans code_risque
-- NB: on conserve (code_indicateur, periode, date_debut) comme identité d'occurrence.
CREATE UNIQUE INDEX IF NOT EXISTS idx_indicateur_occurrences_unique
ON public.indicateur_occurrences (
  COALESCE(code_indicateur::text, ''),
  COALESCE(periode, ''),
  date_debut
);

-- Nettoyage index legacy
DROP INDEX IF EXISTS public.idx_indic_occ_risque;
DROP INDEX IF EXISTS public.idx_indicateur_occurrences_code_risque;
DROP INDEX IF EXISTS public.indicateur_occurrences_code_risque_idx;

COMMIT;
