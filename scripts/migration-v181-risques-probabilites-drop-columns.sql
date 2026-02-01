BEGIN;

-- Suppression des colonnes devenues redondantes dans risques_probabilites.
-- Ces informations sont disponibles via d'autres tables (risques, processus, structures, indicateurs, etc.)
-- et/ou calculables à l'affichage.
ALTER TABLE risques_probabilites
  DROP COLUMN IF EXISTS libelle_risque,
  DROP COLUMN IF EXISTS libelle_processus,
  DROP COLUMN IF EXISTS code_structure,
  DROP COLUMN IF EXISTS libelle_structure,
  DROP COLUMN IF EXISTS qualitatif,
  DROP COLUMN IF EXISTS cible,
  DROP COLUMN IF EXISTS impact_brut,
  DROP COLUMN IF EXISTS efficacite_controle,
  DROP COLUMN IF EXISTS score_brut,
  DROP COLUMN IF EXISTS impact_net,
  DROP COLUMN IF EXISTS score_net,
  DROP COLUMN IF EXISTS criticite_brute,
  DROP COLUMN IF EXISTS niveau_criticite_brute,
  DROP COLUMN IF EXISTS criticite_nette,
  DROP COLUMN IF EXISTS niveau_criticite_nette;

COMMIT;
