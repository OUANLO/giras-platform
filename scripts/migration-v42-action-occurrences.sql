-- =====================================================
-- MIGRATION V42 - Ajout des champs manquants pour action_occurrences
-- =====================================================

-- Ajouter le champ code_occurrence s'il n'existe pas
ALTER TABLE action_occurrences ADD COLUMN IF NOT EXISTS code_occurrence SERIAL;

-- Ajouter le champ responsable s'il n'existe pas
ALTER TABLE action_occurrences ADD COLUMN IF NOT EXISTS responsable VARCHAR(255) REFERENCES users(username);

-- Ajouter le champ createur s'il n'existe pas
ALTER TABLE action_occurrences ADD COLUMN IF NOT EXISTS createur VARCHAR(255);

-- Ajouter le champ date_creation s'il n'existe pas
ALTER TABLE action_occurrences ADD COLUMN IF NOT EXISTS date_creation TIMESTAMP WITH TIME ZONE DEFAULT NOW();

-- Supprimer la contrainte UNIQUE si elle pose problème (periode peut être null)
ALTER TABLE action_occurrences DROP CONSTRAINT IF EXISTS action_occurrences_code_action_periode_key;

-- Créer un index sur code_action pour les performances
CREATE INDEX IF NOT EXISTS idx_action_occurrences_code_action ON action_occurrences(code_action);

-- Créer un index sur responsable
CREATE INDEX IF NOT EXISTS idx_action_occurrences_responsable ON action_occurrences(responsable);
