-- Migration v191
-- Objectif: supprimer la colonne code_processus de la table risques_probabilites.

BEGIN;

ALTER TABLE public.risques_probabilites
  DROP COLUMN IF EXISTS code_processus;

COMMIT;
