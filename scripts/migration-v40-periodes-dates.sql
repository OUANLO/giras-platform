-- Migration v40: Ajout colonnes dates à periodes_evaluation
-- Exécuter dans Supabase SQL Editor

-- Ajouter les colonnes si elles n'existent pas
DO $$ 
BEGIN
    -- Ajouter date_debut
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'periodes_evaluation' AND column_name = 'date_debut') THEN
        ALTER TABLE periodes_evaluation ADD COLUMN date_debut DATE;
    END IF;
    
    -- Ajouter date_fin
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'periodes_evaluation' AND column_name = 'date_fin') THEN
        ALTER TABLE periodes_evaluation ADD COLUMN date_fin DATE;
    END IF;
    
    -- Ajouter date_limite_saisie
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'periodes_evaluation' AND column_name = 'date_limite_saisie') THEN
        ALTER TABLE periodes_evaluation ADD COLUMN date_limite_saisie DATE;
    END IF;
    
    -- Ajouter date_modification
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'periodes_evaluation' AND column_name = 'date_modification') THEN
        ALTER TABLE periodes_evaluation ADD COLUMN date_modification TIMESTAMP WITH TIME ZONE;
    END IF;
    
    -- Ajouter modificateur
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'periodes_evaluation' AND column_name = 'modificateur') THEN
        ALTER TABLE periodes_evaluation ADD COLUMN modificateur VARCHAR(100);
    END IF;
END $$;

-- Mettre à jour les dates des périodes existantes basé sur annee/semestre/trimestre/mois
UPDATE periodes_evaluation 
SET 
    date_debut = CASE 
        WHEN mois IS NOT NULL THEN (annee || '-' || LPAD(mois::text, 2, '0') || '-01')::DATE
        WHEN trimestre IS NOT NULL THEN (annee || '-' || LPAD(((trimestre-1)*3+1)::text, 2, '0') || '-01')::DATE
        WHEN semestre IS NOT NULL AND semestre = 1 THEN (annee || '-01-01')::DATE
        WHEN semestre IS NOT NULL AND semestre = 2 THEN (annee || '-07-01')::DATE
        ELSE (annee || '-01-01')::DATE
    END,
    date_fin = CASE 
        WHEN mois IS NOT NULL THEN (DATE_TRUNC('month', (annee || '-' || LPAD(mois::text, 2, '0') || '-01')::DATE) + INTERVAL '1 month - 1 day')::DATE
        WHEN trimestre IS NOT NULL THEN (DATE_TRUNC('month', (annee || '-' || LPAD((trimestre*3)::text, 2, '0') || '-01')::DATE) + INTERVAL '1 month - 1 day')::DATE
        WHEN semestre IS NOT NULL AND semestre = 1 THEN (annee || '-06-30')::DATE
        WHEN semestre IS NOT NULL AND semestre = 2 THEN (annee || '-12-31')::DATE
        ELSE (annee || '-12-31')::DATE
    END
WHERE date_debut IS NULL OR date_fin IS NULL;

-- Vérification
SELECT id, annee, semestre, trimestre, mois, date_debut, date_fin, date_limite_saisie, statut 
FROM periodes_evaluation 
ORDER BY annee DESC, id DESC;
