-- Migration v171 (optionnelle) : Nettoyage de la table risques_probabilites
--
-- Objectifs:
-- 1) Ne pas forcer des valeurs quand elles sont logiquement vides.
--    Exemple: jours_retard ne doit pas prendre 0 par défaut si aucune occurrence n'existe.
-- 2) Préparer la suppression des champs dupliqués score_* (doublons avec criticite_*).
--
-- IMPORTANT:
-- - Cette migration est optionnelle. Le code applicatif est compatible même sans cette migration.
-- - Si vous avez déjà des dépendances côté BI/exports sur score_brut / score_net, ne les supprimez pas.

-- 1) Supprimer le DEFAULT 0 de jours_retard pour permettre NULL
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name='risques_probabilites'
      AND column_name='jours_retard'
  ) THEN
    EXECUTE 'ALTER TABLE risques_probabilites ALTER COLUMN jours_retard DROP DEFAULT';
  END IF;
END $$;

-- 2) (Optionnel) supprimer les doublons score_* si vous n'en avez pas besoin
-- Décommentez si souhaité.
-- ALTER TABLE risques_probabilites DROP COLUMN IF EXISTS score_brut;
-- ALTER TABLE risques_probabilites DROP COLUMN IF EXISTS score_net;
