-- Migration v166 : Correction du type de la colonne code_risque dans risques_probabilites
-- Objectif : éviter l'erreur "value too long for type character varying(6)".

DO $$
DECLARE
  char_max integer;
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name = 'risques_probabilites'
  ) THEN
    SELECT character_maximum_length
    INTO char_max
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'risques_probabilites'
      AND column_name = 'code_risque';

    -- Si la colonne est trop courte, on l'agrandit.
    IF char_max IS NOT NULL AND char_max < 50 THEN
      -- Recréer la FK proprement pour éviter les erreurs lors du changement de type
      EXECUTE 'ALTER TABLE risques_probabilites DROP CONSTRAINT IF EXISTS risques_probabilites_code_risque_fkey';
      EXECUTE 'ALTER TABLE risques_probabilites ALTER COLUMN code_risque TYPE VARCHAR(50)';
      EXECUTE 'ALTER TABLE risques_probabilites ADD CONSTRAINT risques_probabilites_code_risque_fkey FOREIGN KEY (code_risque) REFERENCES risques(code_risque) ON DELETE CASCADE';
    END IF;
  END IF;
END $$;
