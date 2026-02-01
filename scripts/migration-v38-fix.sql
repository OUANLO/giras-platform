-- =====================================================
-- SCRIPT DE MIGRATION v38-fix
-- Recrée les groupes par défaut et ajoute les colonnes manquantes
-- =====================================================

-- 1. RECRÉER LE GROUPE D'INDICATEURS PAR DÉFAUT (Risque)
INSERT INTO groupe_indicateurs (code_groupe, libelle_groupe, commentaire, gestionnaire, gestionnaires, is_default, statut, createur)
VALUES ('Risque', 'Indicateurs des risques', 'Groupe réservé aux indicateurs liés aux risques. Les occurrences sont ouvertes automatiquement lors de l''ouverture des périodes de risques.', 'fousseni.ouattara@ipscnam.ci', ARRAY['fousseni.ouattara@ipscnam.ci'], TRUE, 'Actif', 'SYSTEM')
ON CONFLICT (code_groupe) DO UPDATE SET
    libelle_groupe = 'Indicateurs des risques',
    commentaire = 'Groupe réservé aux indicateurs liés aux risques. Les occurrences sont ouvertes automatiquement lors de l''ouverture des périodes de risques.',
    is_default = TRUE,
    statut = 'Actif';

-- 2. RECRÉER LE GROUPE D'ACTIONS PAR DÉFAUT (Risque)
INSERT INTO groupe_actions (code_groupe, libelle_groupe, commentaire, gestionnaire, is_default, statut, createur)
VALUES ('Risque', 'Plan de maîtrise des risques', 'Groupe réservé au plan de maîtrise des risques. Actions liées aux risques identifiés.', 'fousseni.ouattara@ipscnam.ci', TRUE, 'Actif', 'SYSTEM')
ON CONFLICT (code_groupe) DO UPDATE SET
    libelle_groupe = 'Plan de maîtrise des risques',
    commentaire = 'Groupe réservé au plan de maîtrise des risques. Actions liées aux risques identifiés.',
    is_default = TRUE,
    statut = 'Actif';

-- 3. S'assurer que la colonne gestionnaires existe dans groupe_indicateurs
ALTER TABLE groupe_indicateurs ADD COLUMN IF NOT EXISTS gestionnaires TEXT[];

-- 4. Migrer gestionnaire vers gestionnaires si vide
UPDATE groupe_indicateurs 
SET gestionnaires = ARRAY[gestionnaire] 
WHERE gestionnaires IS NULL AND gestionnaire IS NOT NULL;

-- 5. S'assurer que les colonnes periodicite et groupes existent dans indicateurs
ALTER TABLE indicateurs ADD COLUMN IF NOT EXISTS periodicite VARCHAR(20);
ALTER TABLE indicateurs ADD COLUMN IF NOT EXISTS groupes TEXT[];

-- 6. Migrer code_groupe vers groupes si vide
UPDATE indicateurs 
SET groupes = ARRAY[code_groupe] 
WHERE groupes IS NULL AND code_groupe IS NOT NULL;

-- 7. Mettre la périodicité "Personnalise" pour tous les indicateurs du groupe Risque
UPDATE indicateurs 
SET periodicite = 'Personnalise' 
WHERE (groupes && ARRAY['Risque'] OR code_groupe = 'Risque');

-- 8. S'assurer que les colonnes periode et annee existent dans indicateur_occurrences
ALTER TABLE indicateur_occurrences ADD COLUMN IF NOT EXISTS periode VARCHAR(100);
ALTER TABLE indicateur_occurrences ADD COLUMN IF NOT EXISTS annee INTEGER;

-- 9. Vérification finale
SELECT 'Groupes indicateurs:' as info, code_groupe, libelle_groupe, is_default FROM groupe_indicateurs ORDER BY is_default DESC, code_groupe;
SELECT 'Groupes actions:' as info, code_groupe, libelle_groupe, is_default FROM groupe_actions ORDER BY is_default DESC, code_groupe;
