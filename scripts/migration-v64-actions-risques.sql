-- Migration v64: Corriger le type du champ code_action dans actions_risques
-- Le champ doit être TEXT pour accepter des codes comme "RISQUE-A01"

-- Modifier le type de code_action de INTEGER à TEXT
ALTER TABLE actions_risques 
ALTER COLUMN code_action TYPE TEXT USING code_action::TEXT;

-- Ajouter un commentaire pour documenter le changement
COMMENT ON COLUMN actions_risques.code_action IS 'Code action au format RISQUE-A01, RISQUE-A02, etc.';
