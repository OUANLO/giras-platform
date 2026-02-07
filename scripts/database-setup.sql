-- =====================================================
-- SCRIPT SQL POUR SUPABASE - PLATEFORME GIRAS
-- Version mise à jour avec tous les champs spécifiés
-- =====================================================
-- Exécutez ce script dans l'éditeur SQL de Supabase
-- (Dashboard > SQL Editor > New Query)
-- =====================================================

-- Activer l'extension UUID
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =====================================================
-- TABLE: structures
-- Liste des structures composant l'entreprise
-- =====================================================
CREATE TABLE IF NOT EXISTS structures (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    code_structure VARCHAR(20) UNIQUE NOT NULL,
    libelle_structure VARCHAR(255) UNIQUE NOT NULL,
    statut VARCHAR(10) DEFAULT 'Actif' CHECK (statut IN ('Actif', 'Inactif')),
    createur VARCHAR(255),
    date_creation TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    modificateur VARCHAR(255),
    date_modification TIMESTAMP WITH TIME ZONE
);

-- Structure par défaut DERS
INSERT INTO structures (code_structure, libelle_structure, statut, createur)
VALUES ('DERS', 'Direction des Études, des Risques et des Statistiques', 'Actif', 'fousseni.ouattara@ipscnam.ci')
ON CONFLICT (code_structure) DO NOTHING;

-- =====================================================
-- TABLE: processus
-- Liste des processus composant l'entreprise
-- Code_processus doit contenir exactement 4 caractères
-- =====================================================
CREATE TABLE IF NOT EXISTS processus (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    code_processus VARCHAR(4) UNIQUE NOT NULL CHECK (char_length(code_processus) = 4),
    libelle_processus VARCHAR(255) UNIQUE NOT NULL,
    statut VARCHAR(10) DEFAULT 'Actif' CHECK (statut IN ('Actif', 'Inactif')),
    createur VARCHAR(255),
    date_creation TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    modificateur VARCHAR(255),
    date_modification TIMESTAMP WITH TIME ZONE
);

-- =====================================================
-- TABLE: users
-- Liste des utilisateurs de la plateforme
-- 5 types: Super admin, Admin, Super manager, Manager, User
-- =====================================================
CREATE TABLE IF NOT EXISTS users (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    username VARCHAR(255) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL,
    nom VARCHAR(100) NOT NULL,
    prenoms VARCHAR(100) NOT NULL,
    structure VARCHAR(20) REFERENCES structures(code_structure),
    superieur_existe VARCHAR(3) DEFAULT 'Non' CHECK (superieur_existe IN ('Oui', 'Non')),
    superieur VARCHAR(255),
    poste VARCHAR(100) NOT NULL,
    acces_risque VARCHAR(3) DEFAULT 'Non' CHECK (acces_risque IN ('Oui', 'Non')),
    acces_activite VARCHAR(3) DEFAULT 'Non' CHECK (acces_activite IN ('Oui', 'Non')),
    acces_indicateur VARCHAR(3) DEFAULT 'Non' CHECK (acces_indicateur IN ('Oui', 'Non')),
    acces_tb VARCHAR(3) DEFAULT 'Non' CHECK (acces_tb IN ('Oui', 'Non')),
    acces_perform VARCHAR(3) DEFAULT 'Non' CHECK (acces_perform IN ('Oui', 'Non')),
    acces_admin VARCHAR(3) DEFAULT 'Non' CHECK (acces_admin IN ('Oui', 'Non')),
    type_utilisateur VARCHAR(20) NOT NULL CHECK (type_utilisateur IN ('Super admin', 'Admin', 'Super manager', 'Manager', 'User')),
    statut VARCHAR(10) DEFAULT 'Actif' CHECK (statut IN ('Actif', 'Inactif')),
    createur VARCHAR(255),
    date_creation TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    modificateur VARCHAR(255),
    date_modification TIMESTAMP WITH TIME ZONE
);

-- Super Admin par défaut (mot de passe: Admin - hashé avec bcrypt)
INSERT INTO users (
    username, password, nom, prenoms, structure, 
    superieur_existe, poste, acces_risque, acces_activite, 
    acces_indicateur, acces_tb, acces_perform, acces_admin, 
    type_utilisateur, statut, createur
) VALUES (
    'fousseni.ouattara@ipscnam.ci',
    '$2a$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/X4MwW1x6h5TpGHMG2',
    'OUATTARA',
    'OUANLO FOUSSENI',
    'DERS',
    'Non',
    'Chef de Service Statistiques et Développement',
    'Oui', 'Oui', 'Oui', 'Oui', 'Oui', 'Oui',
    'Super admin',
    'Actif',
    'fousseni.ouattara@ipscnam.ci'
) ON CONFLICT (username) DO NOTHING;

-- =====================================================
-- TABLE: categories
-- Liste des catégories de risques
-- code_categorie généré automatiquement (SERIAL)
-- =====================================================
CREATE TABLE IF NOT EXISTS categories (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    code_categorie SERIAL UNIQUE,
    libelle_categorie VARCHAR(255) UNIQUE NOT NULL,
    statut VARCHAR(10) DEFAULT 'Actif' CHECK (statut IN ('Actif', 'Inactif')),
    createur VARCHAR(255),
    date_creation TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    modificateur VARCHAR(255),
    date_modification TIMESTAMP WITH TIME ZONE
);

-- =====================================================
-- TABLE: groupe_indicateurs
-- Liste des groupes d'indicateurs
-- Groupe par défaut "Risque" non modifiable
-- gestionnaires stockés en JSON array pour support multi-gestionnaires
-- =====================================================
CREATE TABLE IF NOT EXISTS groupe_indicateurs (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    code_groupe VARCHAR(50) UNIQUE NOT NULL,
    libelle_groupe VARCHAR(255) NOT NULL,
    commentaire TEXT,
    gestionnaire VARCHAR(255) REFERENCES users(username),
    gestionnaires TEXT[], -- Array de usernames pour multi-gestionnaires
    statut VARCHAR(10) DEFAULT 'Actif' CHECK (statut IN ('Actif', 'Inactif')),
    is_default BOOLEAN DEFAULT FALSE,
    createur VARCHAR(255),
    date_creation TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    modificateur VARCHAR(255),
    date_modification TIMESTAMP WITH TIME ZONE
);

-- Groupe par défaut pour les indicateurs de risques
INSERT INTO groupe_indicateurs (code_groupe, libelle_groupe, commentaire, gestionnaire, gestionnaires, is_default, statut, createur)
VALUES ('Risque', 'Indicateurs des risques', 'Risque', 'fousseni.ouattara@ipscnam.ci', ARRAY['fousseni.ouattara@ipscnam.ci'], TRUE, 'Actif', 'fousseni.ouattara@ipscnam.ci')
ON CONFLICT (code_groupe) DO NOTHING;

-- =====================================================
-- TABLE: indicateurs
-- Liste des indicateurs des différents groupes
-- code_indicateur généré automatiquement (SERIAL)
-- periodicite: obligatoire, non modifiable après création
-- groupes: array pour appartenance à plusieurs groupes
-- =====================================================
CREATE TABLE IF NOT EXISTS indicateurs (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    code_indicateur SERIAL UNIQUE,
    libelle_indicateur VARCHAR(255) NOT NULL,
    code_groupe VARCHAR(50) REFERENCES groupe_indicateurs(code_groupe),
    groupes TEXT[], -- Array de code_groupe pour multi-groupes
    code_structure VARCHAR(20) REFERENCES structures(code_structure),
    type_indicateur VARCHAR(10) CHECK (type_indicateur IN ('Taux', 'Nombre')),
    periodicite VARCHAR(20) NOT NULL CHECK (periodicite IN ('Annuel', 'Semestriel', 'Trimestriel', 'Mensuel', 'Hebdomadaire', 'Journalier', 'Personnalise')),
    numerateur VARCHAR(255),
    denominateur VARCHAR(255),
    source VARCHAR(255),
    sens VARCHAR(10) CHECK (sens IN ('Positif', 'Négatif')),
    seuil1 DECIMAL(10,2),
    seuil2 DECIMAL(10,2),
    seuil3 DECIMAL(10,2),
    seuil4 DECIMAL(10,2),
    responsable VARCHAR(255) REFERENCES users(username),
    commentaire TEXT,
    statut VARCHAR(10) DEFAULT 'Actif' CHECK (statut IN ('Actif', 'Inactif')),
    createur VARCHAR(255),
    date_creation TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    modificateur VARCHAR(255),
    date_modification TIMESTAMP WITH TIME ZONE
);

-- =====================================================
-- TABLE: indicateur_occurrences
-- Occurrences des indicateurs
-- periode: libellé de la période (ex: "2024", "Trimestre 1 2024", etc.)
-- =====================================================
CREATE TABLE IF NOT EXISTS indicateur_occurrences (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    code_indicateur INTEGER REFERENCES indicateurs(code_indicateur),
    code_risque VARCHAR(50),
    periode VARCHAR(100), -- Libellé de la période
    annee INTEGER, -- Année de référence
    date_debut DATE,
    date_fin DATE,
    date_limite_saisie DATE,
    cible DECIMAL(10,2),
    val_numerateur DECIMAL(15,2),
    val_denominateur DECIMAL(15,2),
    val_indicateur DECIMAL(15,4),
    probabilite INTEGER CHECK (probabilite BETWEEN 1 AND 4),
    date_saisie TIMESTAMP WITH TIME ZONE,
    nb_jr_retard INTEGER DEFAULT 0,
    statut VARCHAR(20) DEFAULT 'Pas retard' CHECK (statut IN ('Retard', 'Pas retard')),
    commentaire TEXT,
    modificateur VARCHAR(255),
    date_modification TIMESTAMP WITH TIME ZONE
);

-- Index unique pour code_indicateur + periode
CREATE UNIQUE INDEX IF NOT EXISTS idx_indicateur_occurrences_unique 
ON indicateur_occurrences (COALESCE(code_indicateur::text, ''), COALESCE(code_risque, ''), COALESCE(periode, ''), date_debut);

-- =====================================================
-- TABLE: risques
-- Liste des risques de l'entreprise
-- code_risque doit contenir exactement 6 caractères
-- =====================================================
CREATE TABLE IF NOT EXISTS risques (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    code_risque VARCHAR(6) UNIQUE NOT NULL CHECK (char_length(code_risque) = 6),
    libelle_risque VARCHAR(500) UNIQUE NOT NULL,
    code_processus VARCHAR(4) REFERENCES processus(code_processus),
    code_structure VARCHAR(20) REFERENCES structures(code_structure),
    cause TEXT NOT NULL,
    consequence TEXT NOT NULL,
    impact INTEGER NOT NULL CHECK (impact BETWEEN 1 AND 4),
    efficacite_contr INTEGER NOT NULL CHECK (efficacite_contr BETWEEN 1 AND 4),
    qualitatif VARCHAR(3) DEFAULT 'Non' CHECK (qualitatif IN ('Oui', 'Non')),
    code_indicateur INTEGER REFERENCES indicateurs(code_indicateur),
    categories INTEGER[],
    statut VARCHAR(10) DEFAULT 'Actif' CHECK (statut IN ('Actif', 'Inactif')),
    date_vigueur DATE NOT NULL,
    createur VARCHAR(255),
    date_creation TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    modificateur VARCHAR(255),
    date_modification TIMESTAMP WITH TIME ZONE
);

-- =====================================================
-- TABLE: actions_risques (actions standards)
-- Actions standards liées aux risques selon leur criticité
-- type_action: Haute/Basse (selon niveau de criticité)
-- =====================================================
CREATE TABLE IF NOT EXISTS actions_risques (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    code_action SERIAL UNIQUE,
    libelle_action VARCHAR(500) NOT NULL,
    code_risque VARCHAR(6) REFERENCES risques(code_risque),
    type_action VARCHAR(20) CHECK (type_action IN ('Haute', 'Basse', 'Préventive', 'Corrective', 'Détective')),
    createur VARCHAR(255),
    date_creation TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    modificateur VARCHAR(255),
    date_modification TIMESTAMP WITH TIME ZONE
);

-- =====================================================
-- TABLE: groupe_actions
-- Liste des groupes d'actions
-- Groupe par défaut "Risque" = Plan de maîtrise des risques
-- =====================================================
CREATE TABLE IF NOT EXISTS groupe_actions (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    code_groupe VARCHAR(50) UNIQUE NOT NULL,
    libelle_groupe VARCHAR(255) NOT NULL,
    commentaire TEXT,
    gestionnaire VARCHAR(255) REFERENCES users(username),
    statut VARCHAR(10) DEFAULT 'Actif' CHECK (statut IN ('Actif', 'Inactif')),
    is_default BOOLEAN DEFAULT FALSE,
    createur VARCHAR(255),
    date_creation TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    modificateur VARCHAR(255),
    date_modification TIMESTAMP WITH TIME ZONE
);

-- Groupe par défaut pour le plan de maîtrise des risques
INSERT INTO groupe_actions (code_groupe, libelle_groupe, commentaire, gestionnaire, is_default, statut, createur)
VALUES ('Risque', 'Plan de maîtrise des risques', 'Risque', 'fousseni.ouattara@ipscnam.ci', TRUE, 'Actif', 'fousseni.ouattara@ipscnam.ci')
ON CONFLICT (code_groupe) DO NOTHING;

-- =====================================================
-- TABLE: membres_groupe
-- Membres des groupes d'activités
-- Le gestionnaire est automatiquement membre
-- =====================================================
CREATE TABLE IF NOT EXISTS membres_groupe (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    id_membre SERIAL,
    code_groupe VARCHAR(50) REFERENCES groupe_actions(code_groupe),
    membre VARCHAR(255) REFERENCES users(username),
    createur VARCHAR(255),
    date_creation TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(code_groupe, membre)
);

-- =====================================================
-- TABLE: actions
-- Liste des actions des différents groupes
-- code_action généré automatiquement (SERIAL)
-- =====================================================
CREATE TABLE IF NOT EXISTS actions (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    code_action SERIAL UNIQUE,
    libelle_action VARCHAR(500) NOT NULL,
    code_groupe VARCHAR(50) REFERENCES groupe_actions(code_groupe),
    code_structure VARCHAR(20) REFERENCES structures(code_structure),
    code_risques VARCHAR(10)[],
    date_debut DATE NOT NULL,
    date_fin DATE NOT NULL,
    date_debut_replan DATE,
    date_fin_replan DATE,
    tache VARCHAR(3) DEFAULT 'Non' CHECK (tache IN ('Oui', 'Non')),
    routine VARCHAR(3) DEFAULT 'Non' CHECK (routine IN ('Oui', 'Non')),
    periodicite VARCHAR(20) CHECK (periodicite IN ('Hebdomadaire', 'Mensuelle', 'Trimestrielle', 'Semestrielle', 'Annuelle')),
    responsable VARCHAR(255) REFERENCES users(username),
    statut_act VARCHAR(10) DEFAULT 'Actif' CHECK (statut_act IN ('Actif', 'Inactif')),
    commentaire TEXT,
    createur VARCHAR(255),
    date_creation TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    modificateur VARCHAR(255),
    date_modification TIMESTAMP WITH TIME ZONE
);

-- =====================================================
-- TABLE: action_occurrences
-- Occurrences des actions (générées automatiquement)
-- =====================================================
CREATE TABLE IF NOT EXISTS action_occurrences (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    code_occurrence SERIAL UNIQUE,
    code_action INTEGER REFERENCES actions(code_action),
    date_debut DATE,
    date_fin DATE,
    periode VARCHAR(20),
    responsable VARCHAR(255) REFERENCES users(username),
    statut VARCHAR(10) DEFAULT 'Actif' CHECK (statut IN ('Actif', 'Inactif')),
    tx_avancement DECIMAL(5,2) DEFAULT 0,
    gestionnaire_conf VARCHAR(3) DEFAULT NULL CHECK (gestionnaire_conf IS NULL OR gestionnaire_conf IN ('Oui', 'Non')),
    date_conf TIMESTAMP WITH TIME ZONE,
    niv_avancement VARCHAR(50),
    retard INTEGER DEFAULT 0,
    retard2 VARCHAR(20) DEFAULT 'Pas retard',
    createur VARCHAR(255),
    date_creation TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    modificateur VARCHAR(255),
    date_modification TIMESTAMP WITH TIME ZONE
);

-- =====================================================
-- TABLE: taches
-- Liste des tâches des actions
-- code_tache généré automatiquement (SERIAL)
-- =====================================================
CREATE TABLE IF NOT EXISTS taches (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    code_tache SERIAL UNIQUE,
    libelle_tache VARCHAR(500) NOT NULL,
    code_action INTEGER REFERENCES actions(code_action),
    date_debut DATE,
    date_fin DATE,
    date_debut_replan DATE,
    date_fin_replan DATE,
    date_echeance DATE,
    niv_avancement VARCHAR(50) DEFAULT 'Non entamée',
    tx_avancement DECIMAL(5,2) DEFAULT 0,
    gestionnaire_conf VARCHAR(3) DEFAULT NULL CHECK (gestionnaire_conf IS NULL OR gestionnaire_conf IN ('Oui', 'Non')),
    date_conf TIMESTAMP WITH TIME ZONE,
    date_realisation DATE,
    retard INTEGER DEFAULT 0,
    retard2 VARCHAR(20) DEFAULT 'Pas retard',
    statut_replan VARCHAR(20) DEFAULT 'Initial' CHECK (statut_replan IN ('Initial', 'Replanifié')),
    responsable VARCHAR(255) REFERENCES users(username),
    code_risque VARCHAR(10),
    statut VARCHAR(10) DEFAULT 'Actif' CHECK (statut IN ('Actif', 'Inactif')),
    createur VARCHAR(255),
    date_creation TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    modificateur VARCHAR(255),
    date_modification TIMESTAMP WITH TIME ZONE
);

-- =====================================================
-- TABLE: plan_maitrise_actions
-- Actions du plan de maîtrise des risques
-- =====================================================
CREATE TABLE IF NOT EXISTS plan_maitrise_actions (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    code_action SERIAL UNIQUE,
    libelle_action VARCHAR(500) NOT NULL,
    code_risque VARCHAR(10),
    code_structure VARCHAR(20) REFERENCES structures(code_structure),
    responsable VARCHAR(255) REFERENCES users(username),
    date_debut DATE,
    date_fin DATE,
    date_echeance DATE,
    date_realisation DATE,
    niv_avancement VARCHAR(50) DEFAULT 'Non entamée',
    tx_avancement DECIMAL(5,2) DEFAULT 0,
    commentaire TEXT,
    statut VARCHAR(10) DEFAULT 'Actif' CHECK (statut IN ('Actif', 'Inactif')),
    createur VARCHAR(255),
    date_creation TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    modificateur VARCHAR(255),
    date_modification TIMESTAMP WITH TIME ZONE
);

-- =====================================================
-- TABLE: infos_flash
-- Messages flash affichés sur la plateforme
-- code_info généré automatiquement (SERIAL)
-- =====================================================
CREATE TABLE IF NOT EXISTS infos_flash (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    code_info SERIAL UNIQUE,
    info TEXT NOT NULL,
    date_debut DATE NOT NULL,
    date_fin DATE NOT NULL,
    statut VARCHAR(10) DEFAULT 'Actif' CHECK (statut IN ('Actif', 'Inactif')),
    createur VARCHAR(255),
    date_creation TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =====================================================
-- TABLE: periodes_evaluation
-- Périodes d'évaluation des risques
-- =====================================================
CREATE TABLE IF NOT EXISTS periodes_evaluation (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    annee INTEGER NOT NULL,
    semestre INTEGER CHECK (semestre IN (1, 2)),
    trimestre INTEGER CHECK (trimestre IN (1, 2, 3, 4)),
    mois INTEGER CHECK (mois BETWEEN 1 AND 12),
    statut VARCHAR(10) DEFAULT 'Ouvert' CHECK (statut IN ('Ouvert', 'Fermé')),
    createur VARCHAR(255),
    modificateur VARCHAR(255),
    date_creation TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    date_modification TIMESTAMP WITH TIME ZONE,
    UNIQUE(annee, semestre, trimestre, mois)
);

-- =====================================================
-- TABLE: logs
-- Traçabilité de toutes les actions
-- =====================================================
CREATE TABLE IF NOT EXISTS logs (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    utilisateur VARCHAR(255),
    action VARCHAR(100),
    table_concernee VARCHAR(100),
    id_enregistrement UUID,
    details JSONB,
    ip_address VARCHAR(50),
    date_action TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =====================================================
-- FONCTIONS ET TRIGGERS
-- =====================================================

-- Fonction pour mettre à jour date_modification
CREATE OR REPLACE FUNCTION update_modified_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.date_modification = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Fonction pour calculer niv_avancement
CREATE OR REPLACE FUNCTION calculate_niv_avancement(tx DECIMAL, conf VARCHAR)
RETURNS VARCHAR AS $$
BEGIN
    IF tx IS NULL OR tx = 0 THEN
        RETURN 'Non entamée';
    ELSIF tx < 50 THEN
        RETURN 'En cours – moins de 50%';
    ELSIF tx < 100 THEN
        RETURN 'En cours – plus de 50%';
    ELSIF tx >= 100 AND (conf IS NULL OR conf != 'Oui') THEN
        RETURN 'Terminée – non confirmée';
    ELSIF tx >= 100 AND conf = 'Oui' THEN
        RETURN 'Achevée';
    ELSE
        RETURN 'En cours';
    END IF;
END;
$$ language 'plpgsql';

-- Fonction pour calculer retard2
CREATE OR REPLACE FUNCTION calculate_retard2(retard INTEGER)
RETURNS VARCHAR AS $$
BEGIN
    IF retard > 0 THEN
        RETURN 'Retard';
    ELSE
        RETURN 'Pas retard';
    END IF;
END;
$$ language 'plpgsql';

-- Triggers pour mise à jour automatique de date_modification
DROP TRIGGER IF EXISTS update_structures_modtime ON structures;
CREATE TRIGGER update_structures_modtime
    BEFORE UPDATE ON structures
    FOR EACH ROW
    EXECUTE FUNCTION update_modified_column();

DROP TRIGGER IF EXISTS update_processus_modtime ON processus;
CREATE TRIGGER update_processus_modtime
    BEFORE UPDATE ON processus
    FOR EACH ROW
    EXECUTE FUNCTION update_modified_column();

DROP TRIGGER IF EXISTS update_users_modtime ON users;
CREATE TRIGGER update_users_modtime
    BEFORE UPDATE ON users
    FOR EACH ROW
    EXECUTE FUNCTION update_modified_column();

DROP TRIGGER IF EXISTS update_categories_modtime ON categories;
CREATE TRIGGER update_categories_modtime
    BEFORE UPDATE ON categories
    FOR EACH ROW
    EXECUTE FUNCTION update_modified_column();

DROP TRIGGER IF EXISTS update_risques_modtime ON risques;
CREATE TRIGGER update_risques_modtime
    BEFORE UPDATE ON risques
    FOR EACH ROW
    EXECUTE FUNCTION update_modified_column();

DROP TRIGGER IF EXISTS update_actions_modtime ON actions;
CREATE TRIGGER update_actions_modtime
    BEFORE UPDATE ON actions
    FOR EACH ROW
    EXECUTE FUNCTION update_modified_column();

DROP TRIGGER IF EXISTS update_indicateurs_modtime ON indicateurs;
CREATE TRIGGER update_indicateurs_modtime
    BEFORE UPDATE ON indicateurs
    FOR EACH ROW
    EXECUTE FUNCTION update_modified_column();

DROP TRIGGER IF EXISTS update_taches_modtime ON taches;
CREATE TRIGGER update_taches_modtime
    BEFORE UPDATE ON taches
    FOR EACH ROW
    EXECUTE FUNCTION update_modified_column();

DROP TRIGGER IF EXISTS update_groupe_actions_modtime ON groupe_actions;
CREATE TRIGGER update_groupe_actions_modtime
    BEFORE UPDATE ON groupe_actions
    FOR EACH ROW
    EXECUTE FUNCTION update_modified_column();

DROP TRIGGER IF EXISTS update_groupe_indicateurs_modtime ON groupe_indicateurs;
CREATE TRIGGER update_groupe_indicateurs_modtime
    BEFORE UPDATE ON groupe_indicateurs
    FOR EACH ROW
    EXECUTE FUNCTION update_modified_column();

DROP TRIGGER IF EXISTS update_actions_risques_modtime ON actions_risques;
CREATE TRIGGER update_actions_risques_modtime
    BEFORE UPDATE ON actions_risques
    FOR EACH ROW
    EXECUTE FUNCTION update_modified_column();

DROP TRIGGER IF EXISTS update_plan_maitrise_modtime ON plan_maitrise_actions;
CREATE TRIGGER update_plan_maitrise_modtime
    BEFORE UPDATE ON plan_maitrise_actions
    FOR EACH ROW
    EXECUTE FUNCTION update_modified_column();

-- =====================================================
-- POLITIQUES DE SÉCURITÉ (Row Level Security)
-- =====================================================

-- Activer RLS sur toutes les tables
ALTER TABLE structures ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE processus ENABLE ROW LEVEL SECURITY;
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE risques ENABLE ROW LEVEL SECURITY;
ALTER TABLE actions ENABLE ROW LEVEL SECURITY;
ALTER TABLE indicateurs ENABLE ROW LEVEL SECURITY;
ALTER TABLE infos_flash ENABLE ROW LEVEL SECURITY;
ALTER TABLE groupe_actions ENABLE ROW LEVEL SECURITY;
ALTER TABLE groupe_indicateurs ENABLE ROW LEVEL SECURITY;
ALTER TABLE membres_groupe ENABLE ROW LEVEL SECURITY;
ALTER TABLE taches ENABLE ROW LEVEL SECURITY;
ALTER TABLE action_occurrences ENABLE ROW LEVEL SECURITY;
ALTER TABLE indicateur_occurrences ENABLE ROW LEVEL SECURITY;
ALTER TABLE actions_risques ENABLE ROW LEVEL SECURITY;
ALTER TABLE plan_maitrise_actions ENABLE ROW LEVEL SECURITY;
ALTER TABLE periodes_evaluation ENABLE ROW LEVEL SECURITY;
ALTER TABLE logs ENABLE ROW LEVEL SECURITY;

-- Politique pour permettre la lecture à tous
CREATE POLICY "Allow read access" ON structures FOR SELECT USING (true);
CREATE POLICY "Allow read access" ON users FOR SELECT USING (true);
CREATE POLICY "Allow read access" ON processus FOR SELECT USING (true);
CREATE POLICY "Allow read access" ON categories FOR SELECT USING (true);
CREATE POLICY "Allow read access" ON risques FOR SELECT USING (true);
CREATE POLICY "Allow read access" ON actions FOR SELECT USING (true);
CREATE POLICY "Allow read access" ON indicateurs FOR SELECT USING (true);
CREATE POLICY "Allow read access" ON infos_flash FOR SELECT USING (true);
CREATE POLICY "Allow read access" ON groupe_actions FOR SELECT USING (true);
CREATE POLICY "Allow read access" ON groupe_indicateurs FOR SELECT USING (true);
CREATE POLICY "Allow read access" ON membres_groupe FOR SELECT USING (true);
CREATE POLICY "Allow read access" ON taches FOR SELECT USING (true);
CREATE POLICY "Allow read access" ON action_occurrences FOR SELECT USING (true);
CREATE POLICY "Allow read access" ON indicateur_occurrences FOR SELECT USING (true);
CREATE POLICY "Allow read access" ON actions_risques FOR SELECT USING (true);
CREATE POLICY "Allow read access" ON plan_maitrise_actions FOR SELECT USING (true);
CREATE POLICY "Allow read access" ON periodes_evaluation FOR SELECT USING (true);
CREATE POLICY "Allow read access" ON logs FOR SELECT USING (true);

-- Politique pour permettre toutes les opérations via service role
CREATE POLICY "Allow all for service role" ON structures FOR ALL USING (true);
CREATE POLICY "Allow all for service role" ON users FOR ALL USING (true);
CREATE POLICY "Allow all for service role" ON processus FOR ALL USING (true);
CREATE POLICY "Allow all for service role" ON categories FOR ALL USING (true);
CREATE POLICY "Allow all for service role" ON risques FOR ALL USING (true);
CREATE POLICY "Allow all for service role" ON actions FOR ALL USING (true);
CREATE POLICY "Allow all for service role" ON indicateurs FOR ALL USING (true);
CREATE POLICY "Allow all for service role" ON infos_flash FOR ALL USING (true);
CREATE POLICY "Allow all for service role" ON groupe_actions FOR ALL USING (true);
CREATE POLICY "Allow all for service role" ON groupe_indicateurs FOR ALL USING (true);
CREATE POLICY "Allow all for service role" ON membres_groupe FOR ALL USING (true);
CREATE POLICY "Allow all for service role" ON taches FOR ALL USING (true);
CREATE POLICY "Allow all for service role" ON action_occurrences FOR ALL USING (true);
CREATE POLICY "Allow all for service role" ON indicateur_occurrences FOR ALL USING (true);
CREATE POLICY "Allow all for service role" ON actions_risques FOR ALL USING (true);
CREATE POLICY "Allow all for service role" ON plan_maitrise_actions FOR ALL USING (true);
CREATE POLICY "Allow all for service role" ON periodes_evaluation FOR ALL USING (true);
CREATE POLICY "Allow all for service role" ON logs FOR ALL USING (true);

-- =====================================================
-- INDEX POUR PERFORMANCES
-- =====================================================

CREATE INDEX IF NOT EXISTS idx_users_structure ON users(structure);
CREATE INDEX IF NOT EXISTS idx_users_type ON users(type_utilisateur);
CREATE INDEX IF NOT EXISTS idx_users_statut ON users(statut);
CREATE INDEX IF NOT EXISTS idx_users_superieur ON users(superieur);

CREATE INDEX IF NOT EXISTS idx_risques_structure ON risques(code_structure);
CREATE INDEX IF NOT EXISTS idx_risques_processus ON risques(code_processus);
CREATE INDEX IF NOT EXISTS idx_risques_statut ON risques(statut);

CREATE INDEX IF NOT EXISTS idx_actions_groupe ON actions(code_groupe);
CREATE INDEX IF NOT EXISTS idx_actions_responsable ON actions(responsable);
CREATE INDEX IF NOT EXISTS idx_actions_structure ON actions(code_structure);
CREATE INDEX IF NOT EXISTS idx_actions_statut ON actions(statut_act);

CREATE INDEX IF NOT EXISTS idx_indicateurs_groupe ON indicateurs(code_groupe);
CREATE INDEX IF NOT EXISTS idx_indicateurs_responsable ON indicateurs(responsable);
CREATE INDEX IF NOT EXISTS idx_indicateurs_structure ON indicateurs(code_structure);
CREATE INDEX IF NOT EXISTS idx_indicateurs_statut ON indicateurs(statut);

CREATE INDEX IF NOT EXISTS idx_taches_action ON taches(code_action);
CREATE INDEX IF NOT EXISTS idx_taches_responsable ON taches(responsable);
CREATE INDEX IF NOT EXISTS idx_taches_statut ON taches(statut);

CREATE INDEX IF NOT EXISTS idx_action_occ_action ON action_occurrences(code_action);
CREATE INDEX IF NOT EXISTS idx_action_occ_periode ON action_occurrences(periode);

CREATE INDEX IF NOT EXISTS idx_indic_occ_indicateur ON indicateur_occurrences(code_indicateur);
CREATE INDEX IF NOT EXISTS idx_indic_occ_periode ON indicateur_occurrences(periode);
CREATE INDEX IF NOT EXISTS idx_indic_occ_risque ON indicateur_occurrences(code_risque);

CREATE INDEX IF NOT EXISTS idx_membres_groupe ON membres_groupe(code_groupe);
CREATE INDEX IF NOT EXISTS idx_membres_membre ON membres_groupe(membre);

CREATE INDEX IF NOT EXISTS idx_actions_risques_risque ON actions_risques(code_risque);

CREATE INDEX IF NOT EXISTS idx_plan_maitrise_risque ON plan_maitrise_actions(code_risque);
CREATE INDEX IF NOT EXISTS idx_plan_maitrise_responsable ON plan_maitrise_actions(responsable);

CREATE INDEX IF NOT EXISTS idx_logs_utilisateur ON logs(utilisateur);
CREATE INDEX IF NOT EXISTS idx_logs_date ON logs(date_action);

-- =====================================================
-- SCRIPT DE MIGRATION (si tables existantes)
-- Ajouter les colonnes manquantes
-- =====================================================

-- Ajouter code_risque à indicateur_occurrences si manquant
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'indicateur_occurrences' AND column_name = 'code_risque') THEN
        ALTER TABLE indicateur_occurrences ADD COLUMN code_risque VARCHAR(50);
    END IF;
END $$;

-- Ajouter probabilite à indicateur_occurrences si manquant
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'indicateur_occurrences' AND column_name = 'probabilite') THEN
        ALTER TABLE indicateur_occurrences ADD COLUMN probabilite INTEGER CHECK (probabilite BETWEEN 1 AND 4);
    END IF;
END $$;

-- Ajouter date_debut_replan et date_fin_replan à actions si manquant
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'actions' AND column_name = 'date_debut_replan') THEN
        ALTER TABLE actions ADD COLUMN date_debut_replan DATE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'actions' AND column_name = 'date_fin_replan') THEN
        ALTER TABLE actions ADD COLUMN date_fin_replan DATE;
    END IF;
END $$;

-- Renommer statut en statut_act pour actions si nécessaire
DO $$ 
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'actions' AND column_name = 'statut') 
       AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'actions' AND column_name = 'statut_act') THEN
        ALTER TABLE actions RENAME COLUMN statut TO statut_act;
    END IF;
END $$;

-- Ajouter champs manquants à taches
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'taches' AND column_name = 'date_echeance') THEN
        ALTER TABLE taches ADD COLUMN date_echeance DATE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'taches' AND column_name = 'niv_avancement') THEN
        ALTER TABLE taches ADD COLUMN niv_avancement VARCHAR(50) DEFAULT 'Non entamée';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'taches' AND column_name = 'date_realisation') THEN
        ALTER TABLE taches ADD COLUMN date_realisation DATE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'taches' AND column_name = 'statut') THEN
        ALTER TABLE taches ADD COLUMN statut VARCHAR(10) DEFAULT 'Actif' CHECK (statut IN ('Actif', 'Inactif'));
    END IF;
END $$;

-- Ajouter id_membre à membres_groupe si manquant
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'membres_groupe' AND column_name = 'id_membre') THEN
        ALTER TABLE membres_groupe ADD COLUMN id_membre SERIAL;
    END IF;
END $$;

-- =====================================================
-- FIN DU SCRIPT
-- =====================================================
