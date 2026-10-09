-- Migration 001: Initial Schema Checkpoint
-- Establishes schema_migrations tracking table and confirms base database extensions.

CREATE TABLE IF NOT EXISTS schema_migrations (
    version VARCHAR(64) PRIMARY KEY,
    description TEXT,
    applied_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
    execution_time_ms INTEGER
);

COMMENT ON TABLE schema_migrations IS 'Controle de versões e histórico de migrações executadas no banco de dados.';

-- Permissão de leitura para auditoria
GRANT SELECT ON schema_migrations TO app_reader;
