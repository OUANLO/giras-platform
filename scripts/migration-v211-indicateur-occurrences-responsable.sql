-- Migration v211 - Responsable au niveau des occurrences d'indicateurs
-- Permet de choisir, à l'ouverture d'une occurrence, un responsable parmi :
-- 1) les membres de la structure de l'indicateur ;
-- 2) les gestionnaires du groupe d'indicateurs.

ALTER TABLE IF EXISTS public.indicateur_occurrences
ADD COLUMN IF NOT EXISTS responsable TEXT;

-- Initialisation des occurrences existantes avec le responsable de l'indicateur.
UPDATE public.indicateur_occurrences io
SET responsable = i.responsable
FROM public.indicateurs i
WHERE io.code_indicateur = i.code_indicateur
  AND (io.responsable IS NULL OR btrim(io.responsable) = '')
  AND i.responsable IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_indicateur_occurrences_responsable
ON public.indicateur_occurrences(responsable);
