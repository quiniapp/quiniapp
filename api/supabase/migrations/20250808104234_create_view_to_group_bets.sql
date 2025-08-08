CREATE VIEW bets_by_number AS
SELECT
  number,
  SUM(amount) AS total_amount
FROM bets
-- You can also filter here if you like:
-- WHERE date = '2025-08-07'
GROUP BY number;
