-- =====================================================
-- TEST SYNCHRONISATION risques_probabilites (CORRIGÉ)
-- =====================================================
-- Ce script permet de tester manuellement la
-- synchronisation entre indicateur_occurrences et
-- risques_probabilites
-- =====================================================

-- ÉTAPE 1: Identifier un indicateur lié à un risque
-- =====================================================
SELECT 
    i.code_indicateur,
    i.libelle_indicateur,
    i.sens,
    i.seuil1,
    i.seuil2,
    i.seuil3,
    r.code_risque,
    r.libelle_risque
FROM indicateurs i
INNER JOIN risques r ON r.code_indicateur = i.code_indicateur
WHERE i.code_indicateur IS NOT NULL
LIMIT 5;

-- ÉTAPE 2: Vérifier les occurrences existantes pour un indicateur
-- =====================================================
-- Remplacer 'IND-XXX' par un code_indicateur réel
SELECT 
    io.id,
    io.code_indicateur,
    io.periode,
    io.val_indicateur,
    io.val_numerateur,
    io.val_denominateur,
    io.probabilite,
    io.date_saisie,
    io.date_modification
FROM indicateur_occurrences io
WHERE io.code_indicateur = 'IND-XXX'  -- ← REMPLACER ICI
ORDER BY io.date_modification DESC;

-- ÉTAPE 3: Vérifier les entrées correspondantes dans risques_probabilites
-- =====================================================
-- Remplacer 'IND-XXX' par le même code_indicateur
SELECT 
    rp.code_risque,
    rp.periode,
    rp.code_indicateur,
    rp.probabilite,
    rp.valeur_indicateur,
    rp.ind_obtenu,
    rp.responsable,
    rp.date_saisie,
    rp.date_modification,
    rp.archive
FROM risques_probabilites rp
WHERE rp.code_indicateur = 'IND-XXX'  -- ← REMPLACER ICI
ORDER BY rp.date_modification DESC;

-- ÉTAPE 4: Comparer les données entre les deux tables
-- =====================================================
-- Cette requête affiche côte à côte les données des deux tables
-- pour vérifier la cohérence
SELECT 
    io.code_indicateur,
    io.periode,
    io.probabilite as proba_occurrence,
    rp.probabilite as proba_risque,
    io.val_indicateur as valeur_occurrence,
    rp.valeur_indicateur as valeur_risque,
    io.date_saisie as saisie_occurrence,
    rp.date_saisie as saisie_risque,
    CASE 
        WHEN io.probabilite = rp.probabilite THEN '✓ OK'
        WHEN io.probabilite IS NULL AND rp.probabilite IS NULL THEN '⚠ NULL'
        ELSE '✗ DIFFÉRENT'
    END as statut_sync
FROM indicateur_occurrences io
INNER JOIN risques r ON r.code_indicateur = io.code_indicateur
LEFT JOIN risques_probabilites rp 
    ON rp.code_risque = r.code_risque 
    AND rp.periode = io.periode 
    AND rp.code_indicateur = io.code_indicateur
WHERE io.code_indicateur = 'IND-XXX'  -- ← REMPLACER ICI
ORDER BY io.date_modification DESC;

-- ÉTAPE 5: Identifier les occurrences sans synchronisation
-- =====================================================
-- Cette requête liste les occurrences d'indicateurs liés à des risques
-- qui n'ont PAS d'entrée correspondante dans risques_probabilites
SELECT 
    io.id,
    io.code_indicateur,
    io.periode,
    io.probabilite,
    io.val_indicateur,
    r.code_risque,
    r.libelle_risque,
    'Synchronisation manquante' as probleme
FROM indicateur_occurrences io
INNER JOIN risques r ON r.code_indicateur = io.code_indicateur
LEFT JOIN risques_probabilites rp 
    ON rp.code_risque = r.code_risque 
    AND rp.periode = io.periode 
    AND rp.code_indicateur = io.code_indicateur
WHERE rp.id IS NULL
  AND io.probabilite IS NOT NULL
ORDER BY io.date_modification DESC
LIMIT 20;

-- ÉTAPE 6: Statistiques de synchronisation
-- =====================================================
SELECT 
    COUNT(DISTINCT io.id) as total_occurrences_avec_risque,
    COUNT(DISTINCT rp.id) as total_risques_probabilites,
    COUNT(DISTINCT CASE WHEN rp.id IS NOT NULL THEN io.id END) as occurrences_synchronisees,
    COUNT(DISTINCT CASE WHEN rp.id IS NULL THEN io.id END) as occurrences_non_synchronisees,
    ROUND(
        100.0 * COUNT(DISTINCT CASE WHEN rp.id IS NOT NULL THEN io.id END) / 
        NULLIF(COUNT(DISTINCT io.id), 0), 
        2
    ) as taux_synchronisation_pct
FROM indicateur_occurrences io
INNER JOIN risques r ON r.code_indicateur = io.code_indicateur
LEFT JOIN risques_probabilites rp 
    ON rp.code_risque = r.code_risque 
    AND rp.periode = io.periode 
    AND rp.code_indicateur = io.code_indicateur;

-- ÉTAPE 7: Vérifier les périodes ouvertes vs fermées
-- =====================================================
SELECT 
    pe.id as periode_id,
    COALESCE(
        pe.libelle_periode,
        CASE 
            WHEN pe.mois IS NOT NULL THEN CONCAT(pe.mois, '-', pe.annee)
            WHEN pe.trimestre IS NOT NULL THEN CONCAT('T', pe.trimestre, '-', pe.annee)
            WHEN pe.semestre IS NOT NULL THEN CONCAT('S', pe.semestre, '-', pe.annee)
            ELSE CAST(pe.annee AS TEXT)
        END
    ) as periode_libelle,
    pe.annee,
    pe.semestre,
    pe.trimestre,
    pe.mois,
    pe.statut,
    pe.date_debut,
    pe.date_fin,
    COUNT(DISTINCT io.id) as nb_occurrences,
    COUNT(DISTINCT rp.id) as nb_risques_probabilites
FROM periodes_evaluation pe
LEFT JOIN indicateur_occurrences io ON (
    io.periode = pe.libelle_periode 
    OR io.periode = CONCAT(pe.mois, '-', pe.annee)
    OR io.periode = CONCAT('T', pe.trimestre, '-', pe.annee)
    OR io.periode = CONCAT('S', pe.semestre, '-', pe.annee)
    OR io.periode = CAST(pe.annee AS TEXT)
)
LEFT JOIN risques_probabilites rp ON (
    rp.periode = pe.libelle_periode
    OR rp.periode = CONCAT(pe.mois, '-', pe.annee)
    OR rp.periode = CONCAT('T', pe.trimestre, '-', pe.annee)
    OR rp.periode = CONCAT('S', pe.semestre, '-', pe.annee)
    OR rp.periode = CAST(pe.annee AS TEXT)
)
GROUP BY 
    pe.id, 
    pe.libelle_periode, 
    pe.annee, 
    pe.semestre, 
    pe.trimestre, 
    pe.mois, 
    pe.statut, 
    pe.date_debut, 
    pe.date_fin
ORDER BY 
    pe.annee DESC NULLS LAST, 
    pe.semestre DESC NULLS LAST, 
    pe.trimestre DESC NULLS LAST, 
    pe.mois DESC NULLS LAST;

-- ÉTAPE 8: Liste des indicateurs avec leurs risques liés
-- =====================================================
SELECT 
    i.code_indicateur,
    i.libelle_indicateur,
    COUNT(DISTINCT r.code_risque) as nb_risques_lies,
    STRING_AGG(DISTINCT r.code_risque, ', ') as codes_risques,
    COUNT(DISTINCT io.id) as nb_occurrences,
    COUNT(DISTINCT rp.id) as nb_synchronisations
FROM indicateurs i
LEFT JOIN risques r ON r.code_indicateur = i.code_indicateur
LEFT JOIN indicateur_occurrences io ON io.code_indicateur = i.code_indicateur
LEFT JOIN risques_probabilites rp ON rp.code_indicateur = i.code_indicateur
GROUP BY i.code_indicateur, i.libelle_indicateur
HAVING COUNT(DISTINCT r.code_risque) > 0
ORDER BY nb_occurrences DESC;

-- RÉSULTATS ATTENDUS
-- =====================================================
-- ✅ ÉTAPE 1: Doit afficher au moins un indicateur lié à un risque
-- ✅ ÉTAPE 2: Doit afficher les occurrences de cet indicateur
-- ✅ ÉTAPE 3: Doit afficher les entrées correspondantes dans risques_probabilites
-- ✅ ÉTAPE 4: Le statut_sync doit être '✓ OK' pour toutes les lignes
-- ✅ ÉTAPE 5: Ne doit retourner AUCUNE ligne (toutes synchronisées)
-- ✅ ÉTAPE 6: Le taux_synchronisation_pct doit être proche de 100%
-- ✅ ÉTAPE 7: Les périodes ouvertes doivent avoir des occurrences synchronisées
-- ✅ ÉTAPE 8: Affiche les indicateurs avec leurs risques liés et statistiques
