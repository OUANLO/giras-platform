-- Supprime les colonnes redondantes de la table logs.
-- Le champ details conserve les informations utiles d'audit.

alter table if exists public.logs drop column if exists nouvelles_valeurs;
alter table if exists public.logs drop column if exists anciennes_valeurs;
alter table if exists public.logs drop column if exists champs_modifies;
alter table if exists public.logs drop column if exists enregistrements_concernes;
alter table if exists public.logs drop column if exists tables_concernees;
alter table if exists public.logs drop column if exists type_utilisateur;
alter table if exists public.logs drop column if exists heure_action;
alter table if exists public.logs drop column if exists ip_address;
