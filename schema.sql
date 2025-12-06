
-- Exemple de schéma minimal pour démarrer GIRAS dans Supabase
-- Adaptez et complétez à partir de votre cahier des charges détaillé.

create table if not exists Structure (
  Code_structure varchar(10) primary key,
  Libelle_structure text not null,
  Type_structure text,
  Statut text default 'Actif'
);

create table if not exists Processus (
  Code_processus varchar(10) primary key,
  Libelle_processus text not null,
  Code_structure varchar(10) references Structure(Code_structure),
  Statut text default 'Actif'
);

create table if not exists User (
  Id bigint generated always as identity primary key,
  Code_utilisateur varchar(10),
  Nom text not null,
  Prenoms text not null,
  Username text unique not null,
  Type_utilisateur text not null,
  Statut text default 'Actif',
  Code_structure varchar(10) references Structure(Code_structure)
);

create table if not exists Risque (
  Code_risque varchar(6) primary key,
  Libelle_risque text not null,
  Code_processus varchar(10) references Processus(Code_processus),
  Impact integer not null check (Impact between 1 and 4),
  Efficacite_contr integer not null check (Efficacite_contr between 1 and 4),
  Statut text default 'Actif',
  Createur text,
  Date_creation timestamp with time zone default now()
);

create view if not exists V_Risque_Evaluation as
select
  r.Code_risque,
  r.Code_processus,
  r.Libelle_risque,
  r.Impact,
  greatest(1, 4 - r.Efficacite_contr) as Probabilite,
  (r.Impact * greatest(1, 4 - r.Efficacite_contr)) * 3 as Criticite
from Risque r;
