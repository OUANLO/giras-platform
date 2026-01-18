-- =====================================================
-- SCRIPT DE MIGRATION v39
-- Recréation des groupes par défaut (Actions et Indicateurs)
-- =====================================================

-- 1. RECRÉER LE GROUPE D'INDICATEURS PAR DÉFAUT (Risque)
INSERT INTO groupe_indicateurs (
    code_groupe, 
    libelle_groupe, 
    commentaire, 
    gestionnaire, 
    gestionnaires, 
    is_default, 
    statut, 
    createur,
    date_creation
)
VALUES (
    'Risque', 
    'Indicateurs des risques', 
    'Groupe réservé aux indicateurs liés aux risques. Les occurrences sont ouvertes automatiquement lors de l''ouverture des périodes de risques.', 
    'fousseni.ouattara@ipscnam.ci', 
    ARRAY['fousseni.ouattara@ipscnam.ci'], 
    TRUE, 
    'Actif', 
    'SYSTEM',
    NOW()
)
ON CONFLICT (code_groupe) DO UPDATE SET
    libelle_groupe = 'Indicateurs des risques',
    commentaire = 'Groupe réservé aux indicateurs liés aux risques. Les occurrences sont ouvertes automatiquement lors de l''ouverture des périodes de risques.',
    is_default = TRUE,
    statut = 'Actif';

-- 2. RECRÉER LE GROUPE D'ACTIONS PAR DÉFAUT (Risque)
INSERT INTO groupe_actions (
    code_groupe, 
    libelle_groupe, 
    commentaire, 
    gestionnaire, 
    is_default, 
    statut, 
    createur,
    date_creation
)
VALUES (
    'Risque', 
    'Plan de maîtrise des risques', 
    'Groupe réservé au plan de maîtrise des risques. Actions liées aux risques identifiés.', 
    'fousseni.ouattara@ipscnam.ci', 
    TRUE, 
    'Actif', 
    'SYSTEM',
    NOW()
)
ON CONFLICT (code_groupe) DO UPDATE SET
    libelle_groupe = 'Plan de maîtrise des risques',
    commentaire = 'Groupe réservé au plan de maîtrise des risques. Actions liées aux risques identifiés.',
    is_default = TRUE,
    statut = 'Actif';

-- 3. Vérification
SELECT 'Groupe Indicateurs:' as type, code_groupe, libelle_groupe, is_default, statut 
FROM groupe_indicateurs 
WHERE code_groupe = 'Risque';

SELECT 'Groupe Actions:' as type, code_groupe, libelle_groupe, is_default, statut 
FROM groupe_actions 
WHERE code_groupe = 'Risque';
