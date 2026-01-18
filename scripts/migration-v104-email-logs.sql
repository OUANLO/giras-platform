-- Migration v104: Table d'archivage des emails
-- À exécuter dans Supabase SQL Editor

-- Supprimer la table si elle existe (pour repartir proprement)
DROP TABLE IF EXISTS email_log;
DROP TABLE IF EXISTS email_logs;

-- Table pour archiver tous les emails envoyés
CREATE TABLE email_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  date_envoi TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  destinataire VARCHAR(255) NOT NULL,
  destinataire_nom VARCHAR(255),
  sujet VARCHAR(500) NOT NULL,
  type_email VARCHAR(100) NOT NULL,
  statut VARCHAR(50) DEFAULT 'envoyé',
  message_id VARCHAR(255),
  nb_actions INTEGER DEFAULT 0,
  nb_indicateurs INTEGER DEFAULT 0,
  details JSONB,
  erreur TEXT,
  source VARCHAR(100) DEFAULT 'manuel',
  createur VARCHAR(255),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index pour les recherches
CREATE INDEX idx_email_logs_date ON email_logs(date_envoi DESC);
CREATE INDEX idx_email_logs_destinataire ON email_logs(destinataire);
CREATE INDEX idx_email_logs_type ON email_logs(type_email);
CREATE INDEX idx_email_logs_statut ON email_logs(statut);

-- IMPORTANT: Désactiver RLS pour cette table (permettre les insertions depuis l'API)
ALTER TABLE email_logs DISABLE ROW LEVEL SECURITY;

-- OU si vous préférez garder RLS activé, créer une policy permissive:
-- ALTER TABLE email_logs ENABLE ROW LEVEL SECURITY;
-- CREATE POLICY "Allow all operations on email_logs" ON email_logs FOR ALL USING (true) WITH CHECK (true);

-- Donner les permissions au rôle service_role (utilisé par l'API)
GRANT ALL ON email_logs TO service_role;
GRANT ALL ON email_logs TO authenticated;
GRANT ALL ON email_logs TO anon;

-- Commentaires
COMMENT ON TABLE email_logs IS 'Archive de tous les emails envoyés par GIRAS';
COMMENT ON COLUMN email_logs.type_email IS 'Type: rappel_quotidien, rappel_manuel, creation_compte, reset_password, attribution_action, attribution_indicateur, confirmation_gestionnaire';
COMMENT ON COLUMN email_logs.source IS 'Source: cron_quotidien (tâche planifiée 8h), manuel (bouton Emailing), automatique (événement système)';
