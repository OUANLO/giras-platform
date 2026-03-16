-- v200 - Suppression des colonnes devenues inutiles

ALTER TABLE IF EXISTS actions
  DROP COLUMN IF EXISTS code_risques,
  DROP COLUMN IF EXISTS date_debut,
  DROP COLUMN IF EXISTS date_fin,
  DROP COLUMN IF EXISTS tache,
  DROP COLUMN IF EXISTS routine,
  DROP COLUMN IF EXISTS periodicite;

ALTER TABLE IF EXISTS action_occurrences
  DROP COLUMN IF EXISTS periode,
  DROP COLUMN IF EXISTS niv_avancement,
  DROP COLUMN IF EXISTS retard,
  DROP COLUMN IF EXISTS retard2;
