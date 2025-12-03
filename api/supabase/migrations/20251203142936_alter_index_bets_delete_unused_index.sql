  -- Eliminar índice sin uso
  -- Tiempo: ~5-10 segundos
  -- Ahorra: 40 KB + overhead en INSERTs
  DROP INDEX IF EXISTS
  idx_bets_date_winner_deleted_created;