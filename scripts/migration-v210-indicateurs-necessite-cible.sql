-- v2.10 - Indicateurs avec ou sans cible
-- Ajout du champ permettant de préciser si un indicateur nécessite une cible.
-- Tous les indicateurs existants sont initialisés à "Oui" conformément à la règle métier.

ALTER TABLE indicateurs
ADD COLUMN IF NOT EXISTS necessite_cible text NOT NULL DEFAULT 'Oui';

UPDATE indicateurs
SET necessite_cible = 'Oui'
WHERE necessite_cible IS NULL OR necessite_cible NOT IN ('Oui', 'Non');

ALTER TABLE indicateurs
DROP CONSTRAINT IF EXISTS indicateurs_necessite_cible_check;

ALTER TABLE indicateurs
ADD CONSTRAINT indicateurs_necessite_cible_check
CHECK (necessite_cible IN ('Oui', 'Non'));
