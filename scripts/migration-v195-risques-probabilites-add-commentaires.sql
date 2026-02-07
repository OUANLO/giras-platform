-- v195 : Ajout du champ commentaires pour la saisie manuelle de probabilité (Analyse)
-- Règle: obligatoire côté application uniquement si probabilite est renseignée

BEGIN;

ALTER TABLE public.risques_probabilites
  ADD COLUMN IF NOT EXISTS commentaires TEXT;

COMMIT;
