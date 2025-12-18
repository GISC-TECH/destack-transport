-- Initial database setup for CTE/MDF-e API
-- This script runs automatically when the database container starts

-- Ensure the database exists
CREATE DATABASE cte_mdfe_db;

-- Create additional databases for testing if needed
CREATE DATABASE cte_mdfe_test_db;

-- Set default encoding
ALTER DATABASE cte_mdfe_db SET client_encoding TO 'utf8';
ALTER DATABASE cte_mdfe_db SET default_transaction_isolation TO 'read committed';
ALTER DATABASE cte_mdfe_db SET timezone TO 'America/Sao_Paulo';

-- Grant all privileges
GRANT ALL PRIVILEGES ON DATABASE cte_mdfe_db TO postgres;
GRANT ALL PRIVILEGES ON DATABASE cte_mdfe_test_db TO postgres;