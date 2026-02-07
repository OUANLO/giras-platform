-- v192: garantir qu'il n'existe qu'une occurrence par (code_indicateur, periode)
-- (utile pour le bouton "Occ." : création des occurrences manquantes de la période ouverte)

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint c
    JOIN pg_class t ON t.oid = c.conrelid
    WHERE t.relname = 'indicateur_occurrences'
      AND c.conname = 'indicateur_occurrences_code_indicateur_periode_key'
  ) THEN
    ALTER TABLE public.indicateur_occurrences
      ADD CONSTRAINT indicateur_occurrences_code_indicateur_periode_key
      UNIQUE (code_indicateur, periode);
  END IF;
END $$;
