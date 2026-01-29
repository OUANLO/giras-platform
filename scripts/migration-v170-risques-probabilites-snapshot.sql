-- Migration v170 : Remplacement des tables archive_* par un snapshot intégré dans risques_probabilites
-- Objectif : risques_probabilites devient la table unique qui contient les valeurs "courantes" (archive=false)
-- et les valeurs figées après fermeture de période (archive=true + raison_archive).

-- 1) Étendre risques_probabilites avec les champs issus de archive_risques_periodes
ALTER TABLE risques_probabilites
  ADD COLUMN IF NOT EXISTS code_periode UUID,
  ADD COLUMN IF NOT EXISTS libelle_periode VARCHAR(255),
  ADD COLUMN IF NOT EXISTS date_debut_periode DATE,
  ADD COLUMN IF NOT EXISTS date_fin_periode DATE,
  ADD COLUMN IF NOT EXISTS code_indicateur VARCHAR(50),
  ADD COLUMN IF NOT EXISTS libelle_indicateur VARCHAR(255),
  ADD COLUMN IF NOT EXISTS qualitatif BOOLEAN,
  ADD COLUMN IF NOT EXISTS ind_obtenu VARCHAR(10),
  ADD COLUMN IF NOT EXISTS cible NUMERIC,
  ADD COLUMN IF NOT EXISTS responsable VARCHAR(255),
  ADD COLUMN IF NOT EXISTS date_limite_saisie DATE,
  ADD COLUMN IF NOT EXISTS date_saisie DATE,
  ADD COLUMN IF NOT EXISTS jours_retard INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS niveau_retard VARCHAR(50),
  ADD COLUMN IF NOT EXISTS code_processus VARCHAR(50),
  ADD COLUMN IF NOT EXISTS libelle_processus VARCHAR(255),
  ADD COLUMN IF NOT EXISTS code_structure VARCHAR(50),
  ADD COLUMN IF NOT EXISTS libelle_structure VARCHAR(255),
  ADD COLUMN IF NOT EXISTS libelle_risque VARCHAR(500),
  ADD COLUMN IF NOT EXISTS valeur_indicateur NUMERIC,
  ADD COLUMN IF NOT EXISTS impact_brut INTEGER,
  ADD COLUMN IF NOT EXISTS efficacite_controle INTEGER,
  ADD COLUMN IF NOT EXISTS score_brut NUMERIC,
  ADD COLUMN IF NOT EXISTS score_net NUMERIC,
  ADD COLUMN IF NOT EXISTS impact_net NUMERIC,
  ADD COLUMN IF NOT EXISTS criticite_brute NUMERIC,
  ADD COLUMN IF NOT EXISTS niveau_criticite_brute VARCHAR(50),
  ADD COLUMN IF NOT EXISTS criticite_nette NUMERIC,
  ADD COLUMN IF NOT EXISTS niveau_criticite_nette VARCHAR(50),
  ADD COLUMN IF NOT EXISTS fichier_cartographie_url TEXT,
  ADD COLUMN IF NOT EXISTS date_archivage TIMESTAMP WITH TIME ZONE,
  ADD COLUMN IF NOT EXISTS archive_par VARCHAR(255),
  ADD COLUMN IF NOT EXISTS archive BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS raison_archive TEXT;

-- 2) Index utiles
CREATE INDEX IF NOT EXISTS idx_risques_probabilites_archive ON risques_probabilites(archive);
CREATE INDEX IF NOT EXISTS idx_risques_probabilites_code_periode ON risques_probabilites(code_periode);

-- 3) (Optionnel) conserver les tables archive_* pour rollback.
-- Si vous souhaitez les supprimer définitivement :
-- DROP TABLE IF EXISTS archive_risques_periodes CASCADE;
-- DROP TABLE IF EXISTS archive_indicateur_occurrences CASCADE;
