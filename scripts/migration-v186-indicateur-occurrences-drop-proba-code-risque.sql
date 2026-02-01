-- Migration v186
-- Objectif:
-- 1) S'assurer que la table indicateur_occurrences ne contient plus les colonnes
--    "probabilite" et "code_risque" (désormais interdites)
--
-- NOTE: cette migration est volontairement idempotente (IF EXISTS) pour éviter les erreurs
--       si la base a déjà appliqué la v185.

ALTER TABLE IF EXISTS public.indicateur_occurrences
  DROP COLUMN IF EXISTS probabilite,
  DROP COLUMN IF EXISTS code_risque;

-- Tentative de suppression d'index éventuels (ne bloque pas si absents)
DROP INDEX IF EXISTS public.indicateur_occurrences_code_risque_idx;
DROP INDEX IF EXISTS public.indicateur_occurrences_probabilite_idx;
