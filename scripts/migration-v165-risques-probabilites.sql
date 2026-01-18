-- Migration v165 : Table pour stocker les probabilités manuelles des risques qualitatifs
-- Cette table stocke les probabilités saisies manuellement pour les risques qualitatifs par période
-- Elle est distincte de indicateur_occurrences qui ne doit être utilisée que pour les indicateurs

-- =====================================================
-- TABLE: risques_probabilites
-- Probabilités manuelles des risques qualitatifs par période
-- =====================================================

CREATE TABLE IF NOT EXISTS risques_probabilites (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    -- IMPORTANT: certains codes risques dépassent 6 caractères (ex: RGPR-10)
    -- On utilise une taille confortable pour éviter les erreurs "value too long for type character varying(6)"
    code_risque VARCHAR(50) NOT NULL REFERENCES risques(code_risque) ON DELETE CASCADE,
    periode VARCHAR(100) NOT NULL, -- Format: "S1-2025", "T1-2025", "Janvier-2025", "2025"
    probabilite INTEGER CHECK (probabilite BETWEEN 1 AND 4),
    modificateur VARCHAR(255),
    date_modification TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(code_risque, periode)
);

-- Index pour recherche rapide
CREATE INDEX IF NOT EXISTS idx_risques_probabilites_code_risque ON risques_probabilites(code_risque);
CREATE INDEX IF NOT EXISTS idx_risques_probabilites_periode ON risques_probabilites(periode);

-- Commentaire sur la table
COMMENT ON TABLE risques_probabilites IS 'Stockage des probabilités manuelles pour les risques qualitatifs par période';
COMMENT ON COLUMN risques_probabilites.code_risque IS 'Code du risque qualitatif';
COMMENT ON COLUMN risques_probabilites.periode IS 'Période au format S1-2025, T1-2025, Janvier-2025 ou 2025';
COMMENT ON COLUMN risques_probabilites.probabilite IS 'Valeur de probabilité (1=Faible, 2=Modéré, 3=Significatif, 4=Critique)';

-- Migration des données existantes depuis indicateur_occurrences
-- Copier les probabilités des occurrences qualitatifs (celles avec code_risque mais sans code_indicateur ou val_indicateur)
INSERT INTO risques_probabilites (code_risque, periode, probabilite, modificateur, date_modification)
SELECT DISTINCT 
    io.code_risque,
    io.periode,
    io.probabilite,
    io.modificateur,
    COALESCE(io.date_modification, NOW())
FROM indicateur_occurrences io
WHERE io.code_risque IS NOT NULL 
  AND io.probabilite IS NOT NULL
  AND (io.code_indicateur IS NULL OR io.val_indicateur IS NULL)
ON CONFLICT (code_risque, periode) DO UPDATE SET
    probabilite = EXCLUDED.probabilite,
    modificateur = EXCLUDED.modificateur,
    date_modification = EXCLUDED.date_modification;

-- Supprimer les occurrences orphelines (celles créées uniquement pour stocker la probabilité des risques qualitatifs)
-- Ce sont les occurrences sans code_indicateur et sans val_indicateur
DELETE FROM indicateur_occurrences 
WHERE code_risque IS NOT NULL 
  AND code_indicateur IS NULL 
  AND val_indicateur IS NULL;
