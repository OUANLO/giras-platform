-- Migration v146: Tables d'archivage des périodes et éléments

-- Table pour stocker les informations des risques à la fermeture d'une période
DROP TABLE IF EXISTS archive_risques_periodes CASCADE;
CREATE TABLE IF NOT EXISTS archive_risques_periodes (
  id SERIAL PRIMARY KEY,
  -- Infos période
  code_periode VARCHAR(50),
  libelle_periode VARCHAR(255),
  date_debut_periode DATE,
  date_fin_periode DATE,
  -- Infos indicateur
  code_indicateur INTEGER,
  libelle_indicateur VARCHAR(255),
  qualitatif VARCHAR(20), -- Quali
  ind_obtenu DECIMAL(15,4), -- Ind. Obt.
  cible DECIMAL(15,2),
  responsable VARCHAR(100),
  date_limite_saisie DATE,
  date_saisie TIMESTAMP,
  jours_retard INTEGER DEFAULT 0,
  niveau_retard VARCHAR(50),
  -- Infos processus
  code_processus VARCHAR(50),
  libelle_processus VARCHAR(255),
  -- Infos structure
  code_structure VARCHAR(50),
  libelle_structure VARCHAR(255),
  -- Infos risque
  code_risque VARCHAR(50),
  libelle_risque TEXT,
  -- Valeur indicateur
  valeur_indicateur DECIMAL(15,4),
  -- Scores et criticités
  impact_brut INTEGER,
  efficacite_controle DECIMAL(5,2),
  probabilite INTEGER, -- proba
  score_brut DECIMAL(10,2),
  score_net DECIMAL(10,2),
  impact_net DECIMAL(10,2),
  criticite_brute DECIMAL(10,2),
  niveau_criticite_brute VARCHAR(50),
  criticite_nette DECIMAL(10,2),
  niveau_criticite_nette VARCHAR(50),
  -- Métadonnées
  fichier_cartographie_url TEXT,
  date_archivage TIMESTAMP DEFAULT NOW(),
  archive_par VARCHAR(100)
);

-- Table pour archiver les occurrences d'indicateurs risques à la fermeture
DROP TABLE IF EXISTS archive_indicateur_occurrences CASCADE;
CREATE TABLE IF NOT EXISTS archive_indicateur_occurrences (
  id SERIAL PRIMARY KEY,
  -- Copie de tous les champs de indicateur_occurrences
  occurrence_id UUID,
  code_indicateur INTEGER,
  code_risque VARCHAR(50),
  periode VARCHAR(100),
  annee INTEGER,
  date_debut DATE,
  date_fin DATE,
  date_limite_saisie DATE,
  cible DECIMAL(10,2),
  val_numerateur DECIMAL(15,2),
  val_denominateur DECIMAL(15,2),
  val_indicateur DECIMAL(15,4),
  probabilite INTEGER,
  date_saisie TIMESTAMP,
  nb_jr_retard INTEGER,
  statut VARCHAR(50),
  commentaire TEXT,
  modificateur VARCHAR(100),
  date_modification TIMESTAMP,
  -- Métadonnées d'archivage
  code_periode_archive VARCHAR(50),
  libelle_periode_archive VARCHAR(255),
  date_archivage TIMESTAMP DEFAULT NOW(),
  archive_par VARCHAR(100),
  raison_archivage VARCHAR(255) DEFAULT 'Fermeture période'
);

-- Table pour les fichiers de cartographie signée
CREATE TABLE IF NOT EXISTS fichiers_cartographie (
  id SERIAL PRIMARY KEY,
  code_periode VARCHAR(50),
  libelle_periode VARCHAR(255),
  nom_fichier VARCHAR(255),
  url_fichier TEXT,
  type_fichier VARCHAR(50),
  taille INTEGER,
  upload_par VARCHAR(100),
  date_upload TIMESTAMP DEFAULT NOW()
);

-- Ajout colonne archive sur les tables concernées
ALTER TABLE groupe_actions ADD COLUMN IF NOT EXISTS archive BOOLEAN DEFAULT FALSE;
ALTER TABLE groupe_actions ADD COLUMN IF NOT EXISTS date_archive TIMESTAMP;
ALTER TABLE groupe_actions ADD COLUMN IF NOT EXISTS archive_par VARCHAR(100);

ALTER TABLE actions ADD COLUMN IF NOT EXISTS archive BOOLEAN DEFAULT FALSE;
ALTER TABLE actions ADD COLUMN IF NOT EXISTS date_archive TIMESTAMP;
ALTER TABLE actions ADD COLUMN IF NOT EXISTS archive_par VARCHAR(100);

ALTER TABLE action_occurrences ADD COLUMN IF NOT EXISTS archive BOOLEAN DEFAULT FALSE;
ALTER TABLE action_occurrences ADD COLUMN IF NOT EXISTS date_archive TIMESTAMP;
ALTER TABLE action_occurrences ADD COLUMN IF NOT EXISTS archive_par VARCHAR(100);

ALTER TABLE groupe_indicateurs ADD COLUMN IF NOT EXISTS archive BOOLEAN DEFAULT FALSE;
ALTER TABLE groupe_indicateurs ADD COLUMN IF NOT EXISTS date_archive TIMESTAMP;
ALTER TABLE groupe_indicateurs ADD COLUMN IF NOT EXISTS archive_par VARCHAR(100);

ALTER TABLE indicateurs ADD COLUMN IF NOT EXISTS archive BOOLEAN DEFAULT FALSE;
ALTER TABLE indicateurs ADD COLUMN IF NOT EXISTS date_archive TIMESTAMP;
ALTER TABLE indicateurs ADD COLUMN IF NOT EXISTS archive_par VARCHAR(100);

ALTER TABLE indicateur_occurrences ADD COLUMN IF NOT EXISTS archive BOOLEAN DEFAULT FALSE;
ALTER TABLE indicateur_occurrences ADD COLUMN IF NOT EXISTS date_archive TIMESTAMP;
ALTER TABLE indicateur_occurrences ADD COLUMN IF NOT EXISTS archive_par VARCHAR(100);

-- Index pour optimiser les requêtes
CREATE INDEX IF NOT EXISTS idx_archive_risques_periodes_code_periode ON archive_risques_periodes(code_periode);
CREATE INDEX IF NOT EXISTS idx_archive_risques_periodes_code_risque ON archive_risques_periodes(code_risque);
CREATE INDEX IF NOT EXISTS idx_archive_indicateur_occurrences_code_periode ON archive_indicateur_occurrences(code_periode_archive);
CREATE INDEX IF NOT EXISTS idx_archive_indicateur_occurrences_code_indicateur ON archive_indicateur_occurrences(code_indicateur);
CREATE INDEX IF NOT EXISTS idx_archive_indicateur_occurrences_occurrence ON archive_indicateur_occurrences(occurrence_id);

-- Index pour les colonnes archive
CREATE INDEX IF NOT EXISTS idx_groupe_actions_archive ON groupe_actions(archive) WHERE archive = false;
CREATE INDEX IF NOT EXISTS idx_actions_archive ON actions(archive) WHERE archive = false;
CREATE INDEX IF NOT EXISTS idx_action_occurrences_archive ON action_occurrences(archive) WHERE archive = false;
CREATE INDEX IF NOT EXISTS idx_groupe_indicateurs_archive ON groupe_indicateurs(archive) WHERE archive = false;
CREATE INDEX IF NOT EXISTS idx_indicateurs_archive ON indicateurs(archive) WHERE archive = false;
CREATE INDEX IF NOT EXISTS idx_indicateur_occurrences_archive ON indicateur_occurrences(archive) WHERE archive = false;
