BEGIN;

-- 1) Supprimer les doublons (garder la ligne la plus récente)
WITH ranked AS (
  SELECT
    ctid AS _ctid,
    code_risque,
    periode,
    ROW_NUMBER() OVER (
      PARTITION BY code_risque, periode
      ORDER BY date_modification DESC NULLS LAST, date_saisie DESC NULLS LAST, ctid DESC
    ) AS rn
  FROM public.risques_probabilites
)
DELETE FROM public.risques_probabilites rp
USING ranked r
WHERE rp.ctid = r._ctid AND r.rn > 1;

-- 2) Supprimer toutes contraintes UNIQUE existantes sur la table
DO $$
DECLARE r RECORD;
BEGIN
  FOR r IN (
    SELECT c.conname
    FROM pg_constraint c
    JOIN pg_class t ON t.oid = c.conrelid
    WHERE t.relname = 'risques_probabilites'
      AND c.contype = 'u'
  ) LOOP
    EXECUTE format('ALTER TABLE public.risques_probabilites DROP CONSTRAINT IF EXISTS %I', r.conname);
  END LOOP;
END $$;

-- 3) Ajouter la contrainte UNIQUE (code_risque, periode)
ALTER TABLE public.risques_probabilites
  ADD CONSTRAINT risques_probabilites_code_risque_periode_key UNIQUE (code_risque, periode);

COMMIT;
