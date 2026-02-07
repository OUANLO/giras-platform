BEGIN;

ALTER TABLE public.risques_probabilites
  ADD COLUMN IF NOT EXISTS ind_obtenu VARCHAR(3);

-- Valeur par défaut pour les lignes existantes : saisie manuelle
UPDATE public.risques_probabilites
SET ind_obtenu = 'Non'
WHERE ind_obtenu IS NULL OR btrim(ind_obtenu) = '';

ALTER TABLE public.risques_probabilites
  ALTER COLUMN ind_obtenu SET DEFAULT 'Non';

ALTER TABLE public.risques_probabilites
  ALTER COLUMN ind_obtenu SET NOT NULL;

ALTER TABLE public.risques_probabilites
  DROP CONSTRAINT IF EXISTS risques_probabilites_ind_obtenu_chk;
ALTER TABLE public.risques_probabilites
  ADD CONSTRAINT risques_probabilites_ind_obtenu_chk CHECK (ind_obtenu IN ('Oui','Non'));

COMMIT;
