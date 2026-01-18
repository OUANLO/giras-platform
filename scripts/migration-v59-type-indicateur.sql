-- Migration v59: Correction type_indicateur
-- À exécuter dans Supabase SQL Editor

-- 1. Supprimer l'ancienne contrainte CHECK
ALTER TABLE indicateurs DROP CONSTRAINT IF EXISTS indicateurs_type_indicateur_check;

-- 2. Ajouter la nouvelle contrainte avec TxCalcule
ALTER TABLE indicateurs ADD CONSTRAINT indicateurs_type_indicateur_check 
CHECK (type_indicateur IN ('Taux', 'TxCalcule', 'Nombre'));

-- 3. Mettre à jour les indicateurs existants avec TauxCalcule vers TxCalcule
UPDATE indicateurs 
SET type_indicateur = 'TxCalcule' 
WHERE type_indicateur = 'TauxCalcule';

-- 4. Supprimer seuil4 si pas encore fait
ALTER TABLE indicateurs DROP COLUMN IF EXISTS seuil4;

-- Vérification
SELECT type_indicateur, COUNT(*) 
FROM indicateurs 
GROUP BY type_indicateur;

