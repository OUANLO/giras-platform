-- Migration v171 : Nettoyage des doublons dans risques_probabilites
-- Constat:
--  - v170 a introduit les colonnes score_brut/score_net en plus de criticite_brute/criticite_nette.
--  - Ces colonnes sont redondantes (elles portent la meme valeur calculee).
--
-- Recommandation:
--  - Conserver criticite_brute et criticite_nette (nomenclature metier "criticite").
--  - Supprimer score_brut et score_net pour eviter toute incoherence.
--
-- IMPORTANT: cette migration est optionnelle mais fortement recommandee.

ALTER TABLE risques_probabilites
  DROP COLUMN IF EXISTS score_brut,
  DROP COLUMN IF EXISTS score_net;
