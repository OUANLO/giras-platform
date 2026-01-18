-- Migration v41 - Activités (Projets, Actions, Occurrences, Tâches)
-- Exécuter ce script dans Supabase SQL Editor

-- =====================================================
-- 1. Modification de la table groupe_actions (Projets)
-- =====================================================

-- Ajouter les nouvelles colonnes si elles n'existent pas
DO $$ 
BEGIN
    -- Colonne gestionnaires (tableau JSONB)
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'groupe_actions' AND column_name = 'gestionnaires') THEN
        ALTER TABLE groupe_actions ADD COLUMN gestionnaires JSONB DEFAULT '[]'::jsonb;
    END IF;
    
    -- Colonne membres (tableau JSONB)
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'groupe_actions' AND column_name = 'membres') THEN
        ALTER TABLE groupe_actions ADD COLUMN membres JSONB DEFAULT '[]'::jsonb;
    END IF;
    
    -- Colonne type_projet (Public/Privé)
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'groupe_actions' AND column_name = 'type_projet') THEN
        ALTER TABLE groupe_actions ADD COLUMN type_projet TEXT DEFAULT 'Public';
    END IF;
END $$;

-- Migrer l'ancien champ gestionnaire vers gestionnaires si nécessaire
UPDATE groupe_actions 
SET gestionnaires = jsonb_build_array(gestionnaire)
WHERE gestionnaire IS NOT NULL 
  AND (gestionnaires IS NULL OR gestionnaires = '[]'::jsonb);

-- Créer le projet RISQUES s'il n'existe pas
INSERT INTO groupe_actions (code_groupe, libelle_groupe, type_projet, statut, gestionnaires, membres, commentaire)
SELECT 'RISQUES', 'Projet des Risques', 'Public', 'Actif', '[]'::jsonb, '[]'::jsonb, 'Projet système pour la gestion des risques'
WHERE NOT EXISTS (SELECT 1 FROM groupe_actions WHERE code_groupe = 'RISQUES');

-- =====================================================
-- 2. Vérification de la table actions
-- =====================================================

-- Ajouter les colonnes manquantes à la table actions
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'actions' AND column_name = 'code_risque') THEN
        ALTER TABLE actions ADD COLUMN code_risque TEXT;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'actions' AND column_name = 'responsable') THEN
        ALTER TABLE actions ADD COLUMN responsable TEXT;
    END IF;
END $$;

-- =====================================================
-- 3. Création de la table action_occurrences
-- =====================================================

CREATE TABLE IF NOT EXISTS action_occurrences (
    id SERIAL PRIMARY KEY,
    code_occurrence INTEGER NOT NULL,
    code_action INTEGER NOT NULL,
    date_debut DATE NOT NULL,
    date_fin DATE NOT NULL,
    responsable TEXT,
    tx_avancement NUMERIC(5,2) DEFAULT 0,
    gestionnaire_conf TEXT,
    date_conf DATE,
    createur TEXT,
    date_creation TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    modificateur TEXT,
    date_modification TIMESTAMP,
    UNIQUE(code_action, date_debut, date_fin)
);

-- Index pour performances
CREATE INDEX IF NOT EXISTS idx_action_occurrences_code_action ON action_occurrences(code_action);
CREATE INDEX IF NOT EXISTS idx_action_occurrences_dates ON action_occurrences(date_debut, date_fin);

-- =====================================================
-- 4. Modification de la table taches
-- =====================================================

-- Ajouter les colonnes manquantes à la table taches
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'taches' AND column_name = 'code_occurrence') THEN
        ALTER TABLE taches ADD COLUMN code_occurrence INTEGER;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'taches' AND column_name = 'tx_avancement') THEN
        ALTER TABLE taches ADD COLUMN tx_avancement NUMERIC(5,2) DEFAULT 0;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'taches' AND column_name = 'responsable') THEN
        ALTER TABLE taches ADD COLUMN responsable TEXT;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'taches' AND column_name = 'commentaire') THEN
        ALTER TABLE taches ADD COLUMN commentaire TEXT;
    END IF;
END $$;

-- Index pour performances
CREATE INDEX IF NOT EXISTS idx_taches_code_occurrence ON taches(code_occurrence);

-- =====================================================
-- 5. Vérification
-- =====================================================

-- Afficher la structure des tables modifiées
SELECT 'groupe_actions' as table_name, column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'groupe_actions'
ORDER BY ordinal_position;

SELECT 'action_occurrences' as table_name, column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'action_occurrences'
ORDER BY ordinal_position;

SELECT 'taches' as table_name, column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'taches'
ORDER BY ordinal_position;

-- Message de fin
SELECT 'Migration v41 - Activités terminée avec succès' as message;
