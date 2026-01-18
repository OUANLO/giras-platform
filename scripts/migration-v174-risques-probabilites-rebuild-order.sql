-- Migration v174 : Recréer risques_probabilites dans l'ordre métier demandé
--
-- PostgreSQL ne permet pas de réordonner les colonnes d'une table existante.
-- Pour obtenir un ordre exact, il faut recréer la table et recopier les données.
--
-- NOTE: on conserve la colonne id (UUID) utilisée par l'API (suppression / sélection),
-- mais elle est placée EN DERNIER pour que les champs métier apparaissent dans l'ordre.

BEGIN;

-- 0) Pré-requis : extension uuid (si non déjà présente)
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1) Créer la nouvelle table avec l'ordre exact des champs métier
CREATE TABLE IF NOT EXISTS risques_probabilites__new (
  code_risque              TEXT NOT NULL,
  periode                  TEXT NOT NULL,
  libelle_risque           TEXT,
  code_processus           TEXT,
  libelle_processus        TEXT,
  code_structure           TEXT,
  libelle_structure        TEXT,
  date_debut_periode       DATE,
  date_fin_periode         DATE,
  modificateur             TEXT,
  date_modification        TIMESTAMPTZ,
  code_indicateur          TEXT,
  libelle_indicateur       TEXT,
  valeur_indicateur        NUMERIC,
  qualitatif               VARCHAR(3),
  ind_obtenu               TEXT,
  cible                    NUMERIC,
  responsable              TEXT,
  date_limite_saisie       DATE,
  date_saisie              DATE,
  jours_retard             INTEGER,
  niveau_retard            TEXT,
  impact_brut              NUMERIC,
  efficacite_controle      NUMERIC,
  probabilite              NUMERIC,
  score_brut               NUMERIC,
  impact_net               NUMERIC,
  score_net                NUMERIC,
  criticite_brute          INTEGER,
  niveau_criticite_brute   TEXT,
  criticite_nette          INTEGER,
  niveau_criticite_nette   TEXT,
  date_archivage           TIMESTAMPTZ,
  archive_par              TEXT,
  archive                  VARCHAR(3) NOT NULL DEFAULT 'Non',

  -- id conservé pour compat API (placé en dernier)
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

  CONSTRAINT chk_archive_oui_non CHECK (archive IN ('Oui','Non')),
  CONSTRAINT chk_qualitatif_oui_non CHECK (qualitatif IS NULL OR qualitatif IN ('Oui','Non'))
);

-- 2) Copier les données depuis l'ancienne table si elle existe
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema='public' AND table_name='risques_probabilites'
  ) THEN
    INSERT INTO risques_probabilites__new (
      code_risque, periode, libelle_risque, code_processus, libelle_processus,
      code_structure, libelle_structure, date_debut_periode, date_fin_periode,
      modificateur, date_modification, code_indicateur, libelle_indicateur,
      valeur_indicateur, qualitatif, ind_obtenu, cible, responsable,
      date_limite_saisie, date_saisie, jours_retard, niveau_retard,
      impact_brut, efficacite_controle, probabilite, score_brut, impact_net,
      score_net, criticite_brute, niveau_criticite_brute, criticite_nette,
      niveau_criticite_nette, date_archivage, archive_par, archive, id
    )
    SELECT
      rp.code_risque,
      rp.periode,
      rp.libelle_risque,
      rp.code_processus,
      rp.libelle_processus,
      rp.code_structure,
      rp.libelle_structure,
      rp.date_debut_periode,
      rp.date_fin_periode,
      rp.modificateur,
      rp.date_modification,
      rp.code_indicateur,
      rp.libelle_indicateur,
      rp.valeur_indicateur,
      rp.qualitatif,
      rp.ind_obtenu,
      rp.cible,
      rp.responsable,
      rp.date_limite_saisie,
      rp.date_saisie,
      rp.jours_retard,
      rp.niveau_retard,
      rp.impact_brut,
      rp.efficacite_controle,
      rp.probabilite,
      rp.score_brut,
      rp.impact_net,
      rp.score_net,
      rp.criticite_brute,
      rp.niveau_criticite_brute,
      rp.criticite_nette,
      rp.niveau_criticite_nette,
      rp.date_archivage,
      rp.archive_par,
      COALESCE(rp.archive, 'Non'),
      COALESCE(rp.id, uuid_generate_v4())
    FROM risques_probabilites rp;
  END IF;
END $$;

-- 3) Remplacer la table
DROP TABLE IF EXISTS risques_probabilites CASCADE;
ALTER TABLE risques_probabilites__new RENAME TO risques_probabilites;

-- 4) Contraintes / Index (UPSERT)
-- Unique attendu par l'UPSERT applicatif
ALTER TABLE risques_probabilites
  ADD CONSTRAINT risques_probabilites_code_risque_periode_ind_key
  UNIQUE (code_risque, periode, code_indicateur);

CREATE INDEX IF NOT EXISTS idx_rp_code_risque ON risques_probabilites(code_risque);
CREATE INDEX IF NOT EXISTS idx_rp_periode ON risques_probabilites(periode);
CREATE INDEX IF NOT EXISTS idx_rp_archive ON risques_probabilites(archive);

COMMIT;
