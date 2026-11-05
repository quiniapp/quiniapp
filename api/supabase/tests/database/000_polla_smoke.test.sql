-- Humo de los tests de Polla: pgTAP disponible y las tablas y funciones que
-- prueban los demás archivos existen. Cada archivo corre en su transacción y
-- termina en ROLLBACK: no deja datos ni la extensión instalada.
BEGIN;
CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;

SELECT plan(6);

SELECT has_table('public', 'polla_editions', 'existe polla_editions');
SELECT has_table('public', 'polla_bets', 'existe polla_bets');
SELECT has_table('public', 'polla_results', 'existe polla_results');
SELECT has_table('public', 'polla_current_accounts', 'existe polla_current_accounts');
SELECT has_function('public', 'polla_create_bet', 'existe polla_create_bet');
SELECT has_function('public', 'polla_process_results_and_accounts', 'existe polla_process_results_and_accounts');

SELECT * FROM finish();
ROLLBACK;
