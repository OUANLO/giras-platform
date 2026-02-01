-- Migration v174 (FIX) : Recréer risques_probabilites (schéma snapshot minimal + ordre stable)

BEGIN;

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Nettoyage au cas où une tentative précédente a laissé une table temporaire
DROP TABLE IF EXISTS risques_probabilites__new CASCADE;

-- Renommer la table existante (si elle existe)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema='public' AND table_name='risques_probabilites'
  ) THEN
    ALTER TABLE risques_probabilites RENAME TO risques_probabilites_old;
  END IF;
END $$;

-- Nouvelle table (schéma minimal)
CREATE TABLE risques_probabilites__new (
  code_risque        TEXT NOT NULL,
  periode            TEXT NOT NULL,
  code_processus     TEXT,
  date_debut_periode DATE,
  date_fin_periode   DATE,
  modificateur       TEXT,
  date_modification  TIMESTAMPTZ,
  code_indicateur    TEXT NOT NULL,
  libelle_indicateur TEXT,
  valeur_indicateur  NUMERIC,
  ind_obtenu         TEXT,
  responsable        TEXT,
  date_limite_saisie DATE,
  date_saisie        DATE,
  jours_retard       INTEGER,
  niveau_retard      TEXT,
  probabilite        NUMERIC,
  date_archivage     TIMESTAMPTZ,
  archive_par        TEXT,
  archive            VARCHAR(3) NOT NULL DEFAULT 'Non',
  id                 UUID NOT NULL DEFAULT uuid_generate_v4(),

  CONSTRAINT chk_archive_oui_non CHECK (archive IN ('Oui','Non')),
  CONSTRAINT risques_probabilites__new_pkey PRIMARY KEY (id)
);

-- Copier les données depuis l'ancienne table si elle existe
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema='public' AND table_name='risques_probabilites_old'
  ) THEN
    IF EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema='public' AND table_name='risques_probabilites_old' AND column_name='id'
    ) THEN
      INSERT INTO risques_probabilites__new (
        code_risque, periode, code_processus, date_debut_periode, date_fin_periode,
        modificateur, date_modification, code_indicateur, libelle_indicateur, valeur_indicateur,
        ind_obtenu, responsable, date_limite_saisie, date_saisie, jours_retard, niveau_retard,
        probabilite, date_archivage, archive_par, archive, id
      )
      SELECT
        rp.code_risque,
        rp.periode,
        rp.code_processus,
        rp.date_debut_periode,
        rp.date_fin_periode,
        rp.modificateur,
        rp.date_modification,
        COALESCE(NULLIF(btrim(rp.code_indicateur), ''), 'QUALI') AS code_indicateur,
        rp.libelle_indicateur,
        rp.valeur_indicateur,
        rp.ind_obtenu,
        rp.responsable,
        rp.date_limite_saisie,
        rp.date_saisie,
        rp.jours_retard,
        rp.niveau_retard,
        rp.probabilite,
        rp.date_archivage,
        rp.archive_par,
        COALESCE(rp.archive, 'Non') AS archive,
        COALESCE(rp.id, uuid_generate_v4()) AS id
      FROM risques_probabilites_old rp;
    ELSE
      INSERT INTO risques_probabilites__new (
        code_risque, periode, code_processus, date_debut_periode, date_fin_periode,
        modificateur, date_modification, code_indicateur, libelle_indicateur, valeur_indicateur,
        ind_obtenu, responsable, date_limite_saisie, date_saisie, jours_retard, niveau_retard,
        probabilite, date_archivage, archive_par, archive
      )
      SELECT
        rp.code_risque,
        rp.periode,
        rp.code_processus,
        rp.date_debut_periode,
        rp.date_fin_periode,
        rp.modificateur,
        rp.date_modification,
        COALESCE(NULLIF(btrim(rp.code_indicateur), ''), 'QUALI') AS code_indicateur,
        rp.libelle_indicateur,
        rp.valeur_indicateur,
        rp.ind_obtenu,
        rp.responsable,
        rp.date_limite_saisie,
        rp.date_saisie,
        rp.jours_retard,
        rp.niveau_retard,
        rp.probabilite,
        rp.date_archivage,
        rp.archive_par,
        COALESCE(rp.archive, 'Non') AS archive
      FROM risques_probabilites_old rp;
    END IF;
  END IF;
END $$;

-- Remplacer la table
DROP TABLE IF EXISTS risques_probabilites CASCADE;
ALTER TABLE risques_probabilites__new RENAME TO risques_probabilites;

-- Contrainte métier attendue par l'UPSERT applicatif
ALTER TABLE risques_probabilites
  DROP CONSTRAINT IF EXISTS risques_probabilites_code_risque_periode_ind_key;

ALTER TABLE risques_probabilites
  ADD CONSTRAINT risques_probabilites_code_risque_periode_ind_key
  UNIQUE (code_risque, periode, code_indicateur);

-- Index utiles
CREATE INDEX IF NOT EXISTS idx_rp_code_risque ON risques_probabilites(code_risque);
CREATE INDEX IF NOT EXISTS idx_rp_periode ON risques_probabilites(periode);
CREATE INDEX IF NOT EXISTS idx_rp_archive ON risques_probabilites(archive);

COMMIT;
