-- ============================================
-- Migration v57 - Suppression de seuil4
-- ============================================
-- À exécuter dans Supabase SQL Editor
-- ============================================

-- 1. Supprimer la colonne seuil4 de la table indicateurs
ALTER TABLE indicateurs DROP COLUMN IF EXISTS seuil4;

-- 2. Vérification
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'indicateurs' 
AND column_name LIKE 'seuil%'
ORDER BY column_name;

-- Résultat attendu: seuil1, seuil2, seuil3 (sans seuil4)
