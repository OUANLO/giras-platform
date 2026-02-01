-- =====================================================
-- VÉRIFICATION STRUCTURE TABLE risques_probabilites
-- =====================================================
-- Ce script vérifie que la table risques_probabilites
-- contient toutes les colonnes nécessaires pour la
-- synchronisation avec indicateur_occurrences
-- =====================================================

-- Afficher la structure actuelle de la table
SELECT 
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns
WHERE table_name = 'risques_probabilites'
ORDER BY ordinal_position;

-- Vérifier l'existence des colonnes critiques
DO $$
DECLARE
    missing_columns TEXT[] := ARRAY[]::TEXT[];
    col_name TEXT;
BEGIN
    -- Liste des colonnes requises
    FOREACH col_name IN ARRAY ARRAY[
        'code_risque',
        'periode',
        'code_indicateur',
        'probabilite',
        'libelle_indicateur',
        'valeur_indicateur',
        'ind_obtenu',
        'responsable',
        'date_limite_saisie',
        'date_saisie',
        'jours_retard',
        'niveau_retard',
        'date_debut_periode',
        'date_fin_periode',
        'code_processus',
        'modificateur',
        'date_modification',
        'archive',
        'date_archivage',
        'archive_par'
    ]
    LOOP
        IF NOT EXISTS (
            SELECT 1 
            FROM information_schema.columns 
            WHERE table_name = 'risques_probabilites' 
            AND column_name = col_name
        ) THEN
            missing_columns := array_append(missing_columns, col_name);
        END IF;
    END LOOP;

    -- Afficher le résultat
    IF array_length(missing_columns, 1) > 0 THEN
        RAISE NOTICE '❌ COLONNES MANQUANTES dans risques_probabilites:';
        FOREACH col_name IN ARRAY missing_columns
        LOOP
            RAISE NOTICE '   - %', col_name;
        END LOOP;
        RAISE EXCEPTION 'La table risques_probabilites ne contient pas toutes les colonnes requises';
    ELSE
        RAISE NOTICE '✅ Toutes les colonnes requises sont présentes dans risques_probabilites';
    END IF;
END $$;

-- Vérifier l'existence de la contrainte unique (clé pour UPSERT)
SELECT 
    constraint_name,
    constraint_type
FROM information_schema.table_constraints
WHERE table_name = 'risques_probabilites'
  AND constraint_type IN ('UNIQUE', 'PRIMARY KEY')
  AND constraint_name LIKE '%code_risque%periode%code_indicateur%'
ORDER BY constraint_name;

-- Si la contrainte n'existe pas, l'afficher
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.table_constraints tc
        JOIN information_schema.key_column_usage kcu 
          ON tc.constraint_name = kcu.constraint_name
        WHERE tc.table_name = 'risques_probabilites'
          AND tc.constraint_type = 'UNIQUE'
          AND EXISTS (
              SELECT 1 FROM information_schema.key_column_usage
              WHERE constraint_name = tc.constraint_name
                AND column_name = 'code_risque'
          )
          AND EXISTS (
              SELECT 1 FROM information_schema.key_column_usage
              WHERE constraint_name = tc.constraint_name
                AND column_name = 'periode'
          )
          AND EXISTS (
              SELECT 1 FROM information_schema.key_column_usage
              WHERE constraint_name = tc.constraint_name
                AND column_name = 'code_indicateur'
          )
    ) THEN
        RAISE NOTICE '⚠️  ATTENTION: La contrainte UNIQUE (code_risque, periode, code_indicateur) n''existe pas';
        RAISE NOTICE '    Le code utilise un fallback (DELETE + INSERT) mais c''est moins performant';
        RAISE NOTICE '    Pour optimiser, exécutez:';
        RAISE NOTICE '    ALTER TABLE risques_probabilites ADD CONSTRAINT risques_probabilites_unique UNIQUE (code_risque, periode, code_indicateur);';
    ELSE
        RAISE NOTICE '✅ La contrainte UNIQUE (code_risque, periode, code_indicateur) existe';
    END IF;
END $$;

-- Afficher quelques exemples de données
SELECT 
    code_risque,
    periode,
    code_indicateur,
    probabilite,
    valeur_indicateur,
    ind_obtenu,
    date_saisie,
    archive
FROM risques_probabilites
ORDER BY date_modification DESC
LIMIT 5;
